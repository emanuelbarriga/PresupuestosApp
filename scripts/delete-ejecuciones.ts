/**
 * One-time cleanup: delete ALL ejecuciones from the old schema.
 *
 * CLI flags:
 *   --dry-run          Log what would be deleted without deleting
 *   --company=<id>     Target a specific company (default: all)
 *
 * Usage:
 *   npx tsx scripts/delete-ejecuciones.ts --dry-run
 *   npx tsx scripts/delete-ejecuciones.ts --company=saman
 *   npx tsx scripts/delete-ejecuciones.ts --company=pacora --dry-run
 *   npx tsx scripts/delete-ejecuciones.ts           # actually delete
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// ── CLI args ────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_COMPANY = process.argv
  .find(a => a.startsWith('--company='))
  ?.split('=')[1];

// ── Firebase Admin SDK — same pattern as seed.ts ────────────────────────────
const serviceAccountPath = path.resolve(
  __dirname, '..',
  'planningsaman-3cf7e-firebase-adminsdk-fbsvc-2ddc38ebca.json',
);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const BATCH_SIZE = 500; // Firestore batch limit

// ── Helpers ─────────────────────────────────────────────────────────────────

function logPrefix(companyId: string): string {
  return `[${companyId}]`;
}

/**
 * Check an ejecucion document for comprobante storage references and log them.
 */
function logComprobantes(companyId: string, ejecucionId: string, data: Record<string, unknown>): void {
  const comprobantes = data.comprobantes;
  if (!Array.isArray(comprobantes) || comprobantes.length === 0) return;

  for (const comp of comprobantes) {
    if (comp && typeof comp === 'object' && 'path' in comp && typeof (comp as Record<string, unknown>).path === 'string') {
      console.log(`  ${logPrefix(companyId)} ⚠  Comprobante storage: ${(comp as Record<string, unknown>).path} (doc: ${ejecucionId})`);
    }
    if (comp && typeof comp === 'object' && 'url' in comp && typeof (comp as Record<string, unknown>).url === 'string') {
      console.log(`  ${logPrefix(companyId)} ⚠  Comprobante URL: ${(comp as Record<string, unknown>).url} (doc: ${ejecucionId})`);
    }
  }
}

/**
 * Delete (or dry-run) all ejecuciones for a single company.
 * Returns the number of documents processed.
 */
async function processCompany(companyId: string): Promise<number> {
  const prefix = logPrefix(companyId);
  let total = 0;

  try {
    while (true) {
      const snapshot = await db
        .collection('companies')
        .doc(companyId)
        .collection('ejecuciones')
        .limit(BATCH_SIZE)
        .get();

      if (snapshot.empty) break;

      // In dry-run mode, just log what we found
      if (DRY_RUN) {
        for (const doc of snapshot.docs) {
          const data = doc.data();
          console.log(`  ${prefix} WOULD delete ejecucion: ${doc.id}`);
          logComprobantes(companyId, doc.id, data);
        }
        total += snapshot.size;
        continue;
      }

      // Actual batch delete
      const batch = db.batch();
      for (const doc of snapshot.docs) {
        // Log comprobantes before deleting (after this we lose the references)
        logComprobantes(companyId, doc.id, doc.data());
        batch.delete(doc.ref);
      }
      await batch.commit();

      total += snapshot.size;
      console.log(`  ${prefix} Deleted batch of ${snapshot.size} ejecuciones (total: ${total})`);
    }

    if (total === 0) {
      console.log(`  ${prefix} No ejecuciones found.`);
    } else if (DRY_RUN) {
      console.log(`  ${prefix} [DRY-RUN] Would delete ${total} ejecuciones. No changes made.`);
    } else {
      console.log(`  ${prefix} ✅ Deleted ${total} ejecuciones.`);
    }
  } catch (err) {
    console.error(`  ${prefix} ❌ Error processing company:`, err);
  }

  return total;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Ejecuciones Cleanup Script\n`);
  console.log(`  Mode:     ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE DELETE'}`);
  console.log(`  Company:  ${TARGET_COMPANY ?? 'ALL'}`);
  console.log();

  // Get companies
  let companiesQuery;
  if (TARGET_COMPANY) {
    const doc = await db.collection('companies').doc(TARGET_COMPANY).get();
    if (!doc.exists) {
      console.error(`Company "${TARGET_COMPANY}" not found.`);
      process.exit(1);
    }
    companiesQuery = [doc];
  } else {
    const snapshot = await db.collection('companies').get();
    if (snapshot.empty) {
      console.log('No companies found. Nothing to do.');
      process.exit(0);
    }
    companiesQuery = snapshot.docs;
  }

  let grandTotal = 0;
  for (const doc of companiesQuery) {
    const companyId = doc.id;
    const companyName = doc.data()?.name ?? companyId;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Company: ${companyName} (${companyId})`);
    const n = await processCompany(companyId);
    grandTotal += n;
  }

  console.log(`\n${'═'.repeat(50)}`);
  if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Summary: ${grandTotal} ejecuciones would be deleted across ${companiesQuery.length} company/ies.`);
    console.log('Run without --dry-run to perform the actual deletion.');
  } else {
    console.log(`\n✅ Complete: ${grandTotal} ejecuciones deleted across ${companiesQuery.length} company/ies.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
