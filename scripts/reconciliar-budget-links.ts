#!/usr/bin/env tsx
/**
 * reconcile-budget-links.ts
 *
 * Reconciliation script for budget link denormalized fields.
 *
 * For each budget in each company:
 *   - Query collectionGroup('budgetLinks') where companyId + budgetId match
 *   - Sum actual montos from the link documents
 *   - Compare against the budget's totalEjecutado and linkedEjecuciones
 *   - If mismatch, update via Firestore transaction
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/reconciliar-budget-links.ts
 *
 * Dry-run mode (read-only, no writes):
 *   npx tsx scripts/reconciliar-budget-links.ts --dry-run
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Init Firebase Admin ──
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.SA_PROJECT_ID,
  private_key_id: process.env.SA_PRIVATE_KEY_ID,
  private_key: process.env.SA_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.SA_CLIENT_EMAIL,
  client_id: process.env.SA_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.SA_CLIENT_CERT_URL,
};

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount as any) });
}
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

const COMPANIES = 'companies';
const BUDGETS = 'budgets';
const BUDGET_LINKS = 'budgetLinks';
const EJECUCIONES = 'ejecuciones';

interface BudgetDoc {
  id: string;
  descripcion: string;
  projectName?: string;
  totalEjecutado?: number;
  linkedEjecuciones?: Array<{ ejecucionId: string; monto: number }>;
}

interface BudgetLinkDoc {
  ejecucionId: string;
  monto: number;
}

async function reconcile(): Promise<void> {
  console.log(`🔍 Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE (will write fixes)'}`);
  console.log('');

  const companiesSnap = await db.collection(COMPANIES).get();
  let totalChecked = 0;
  let totalFixed = 0;

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    console.log(`📁 Company: ${companyDoc.data().name ?? companyId}`);

    // ── Step 1: Build actual totals from budgetLinks subcollections ──
    // Iterate all ejecuciones and their budgetLinks to get the real state.
    const actualByBudget = new Map<string, { sum: number; links: BudgetLinkDoc[] }>();
    const ejecucionesSnap = await db.collection(COMPANIES).doc(companyId).collection(EJECUCIONES).get();

    for (const ejecucionDoc of ejecucionesSnap.docs) {
      const ejecucionId = ejecucionDoc.id;
      const linksSnap = await db
        .collection(COMPANIES).doc(companyId).collection(EJECUCIONES).doc(ejecucionId)
        .collection(BUDGET_LINKS).get();

      for (const linkDoc of linksSnap.docs) {
        const data = linkDoc.data();
        const budgetId = data.budgetId as string;
        const monto = (data.monto as number) ?? 0;
        if (!budgetId) continue;

        if (!actualByBudget.has(budgetId)) {
          actualByBudget.set(budgetId, { sum: 0, links: [] });
        }
        const entry = actualByBudget.get(budgetId)!;
        entry.sum += monto;
        entry.links.push({ ejecucionId, monto });
      }
    }

    // ── Step 2: Compare and fix each budget ──
    const budgetsSnap = await db.collection(COMPANIES).doc(companyId).collection(BUDGETS).get();

    for (const budgetDoc of budgetsSnap.docs) {
      const budget = { id: budgetDoc.id, ...budgetDoc.data() } as BudgetDoc;
      totalChecked++;

      const actual = actualByBudget.get(budget.id);
      const actualSum = actual?.sum ?? 0;
      const actualLinked = actual?.links ?? [];
      const storedTotal = budget.totalEjecutado ?? 0;
      const storedLinked = budget.linkedEjecuciones ?? [];

      const sumMismatch = Math.abs(storedTotal - actualSum) > 1;
      const linksMismatch = JSON.stringify([...storedLinked].sort()) !== JSON.stringify([...actualLinked].sort());

      if (sumMismatch || linksMismatch) {
        console.log(`  ⚠️  Budget: ${budget.descripcion} (${budget.projectName ?? budget.id})`);
        if (sumMismatch) {
          console.log(`     totalEjecutado: ${storedTotal} → ${actualSum} (diff: ${actualSum - storedTotal})`);
        }
        if (linksMismatch) {
          console.log(`     linkedEjecuciones: ${storedLinked.length} items → ${actualLinked.length} items`);
        }

        if (!DRY_RUN) {
          await db.runTransaction(async (tx) => {
            const ref = db.collection(COMPANIES).doc(companyId).collection(BUDGETS).doc(budget.id);
            tx.update(ref, {
              totalEjecutado: actualSum,
              linkedEjecuciones: actualLinked,
            });
          });
        }
        totalFixed++;
      }
    }
  }

  console.log('');
  console.log(`✅ Done. Checked ${totalChecked} budget(s).`);
  if (DRY_RUN) {
    console.log(`   ${totalFixed} budget(s) would be fixed. Run without --dry-run to apply.`);
  } else {
    console.log(`   Fixed ${totalFixed} budget(s).`);
  }
}

reconcile().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
