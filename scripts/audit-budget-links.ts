/**
 * Auditoría de consistencia de budgetLinks.
 *
 * Verifica que las 3 fuentes de datos estén sincronizadas:
 *   a) budgets/{id}.linkedEjecuciones[]
 *   b) ejecuciones/{id}/budgetLinks/{linkId}  (subcolección)
 *   c) ejecuciones.montoAsignadoAcumulado
 *
 * Uso: npx tsx scripts/audit-budget-links.ts
 *
 * Requiere: firebase-admin instalado, cuentaDeServicio/clave.json existente
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// ─── Init ────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '..', 'cuentaDeServicio', 'clave.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ No se encontró cuentaDeServicio/clave.json');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(sa) });
}
const db = getFirestore();

// ─── Helpers ─────────────────────────────────────────────────────────────

interface Issue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  description: string;
  detail: Record<string, unknown>;
}

const issues: Issue[] = [];
let totalBudgets = 0;
let totalEjecuciones = 0;
let totalLinks = 0;

function report(severity: Issue['severity'], type: string, description: string, detail: Record<string, unknown>) {
  issues.push({ severity, type, description, detail });
}

async function getCollectionIds(collectionPath: string): Promise<string[]> {
  const snap = await db.collection(collectionPath).select().get();
  return snap.docs.map(d => d.id);
}

// ─── Audit ───────────────────────────────────────────────────────────────

async function auditCompany(companyId: string) {
  console.log(`\n📁 Empresa: ${companyId}`);
  const budgetIds = await getCollectionIds(`companies/${companyId}/budgets`);
  const ejecucionIds = await getCollectionIds(`companies/${companyId}/ejecuciones`);
  console.log(`   Presupuestos: ${budgetIds.length} | Ejecuciones: ${ejecucionIds.length}`);

  // ── 1. Leer todos los budgets con sus linkedEjecuciones ──
  const budgetsSnap = await db.collection(`companies/${companyId}/budgets`).get();
  const budgets: Map<string, { descripcion: string; linkedEjecuciones: Array<{ ejecucionId: string; monto: number }>; totalEjecutado?: number }> = new Map();
  for (const d of budgetsSnap.docs) {
    const data = d.data();
    budgets.set(d.id, {
      descripcion: data.descripcion ?? '',
      linkedEjecuciones: data.linkedEjecuciones ?? [],
      totalEjecutado: data.totalEjecutado,
    });
  }

  // ── 2. Leer todas las ejecuciones con su montoAsignadoAcumulado ──
  const ejecucionesSnap = await db.collection(`companies/${companyId}/ejecuciones`).get();
  const ejecuciones: Map<string, { descripcion: string; montoEjecutado: number; montoAsignadoAcumulado?: number }> = new Map();
  for (const d of ejecucionesSnap.docs) {
    const data = d.data();
    ejecuciones.set(d.id, {
      descripcion: data.descripcion ?? '',
      montoEjecutado: data.montoEjecutado ?? 0,
      montoAsignadoAcumulado: data.montoAsignadoAcumulado,
    });
  }

  // ── 3. Leer TODOS los budgetLinks (paralelo, una query por ejecución) ──
  const linksByEjecucion = new Map<string, Map<string, { monto: number }>>();
  const linkResults = await Promise.allSettled(
    Array.from(ejecuciones.keys()).map(async (ejecucionId) => {
      const linksSnap = await db.collection(`companies/${companyId}/ejecuciones/${ejecucionId}/budgetLinks`).get();
      if (linksSnap.docs.length === 0) return null;
      const linkMap = new Map<string, { monto: number }>();
      for (const d of linksSnap.docs) {
        const data = d.data();
        linkMap.set(data.budgetId, { monto: data.monto ?? 0 });
      }
      return { ejecucionId, linkMap };
    }),
  );
  for (const result of linkResults) {
    if (result.status === 'fulfilled' && result.value) {
      linksByEjecucion.set(result.value.ejecucionId, result.value.linkMap);
    }
  }
  const totalLinkDocs = Array.from(linksByEjecucion.values()).reduce((s, m) => s + m.size, 0);

  // ── 4. Para cada budget, verificar linkedEjecuciones vs budgetLinks ──
  for (const [budgetId, budget] of budgets) {
    const fromLinks: Array<{ ejecucionId: string; monto: number }> = [];
    for (const [ejecucionId, links] of linksByEjecucion) {
      const link = links.get(budgetId);
      if (link) {
        fromLinks.push({ ejecucionId, monto: link.monto });
      }
    }

    const fromBudget = budget.linkedEjecuciones;

    // Check: linkedEjecuciones has entries not in budgetLinks
    for (const le of fromBudget) {
      const linkMap = linksByEjecucion.get(le.ejecucionId);
      const link = linkMap?.get(budgetId);
      if (!link) {
        report('HIGH', 'linked_ejecucion_orphaned',
          `budget ${budgetId} dice tener ejecucion ${le.ejecucionId} pero no hay budgetLink`,
          { companyId, budgetId, ejecucionId: le.ejecucionId, monto: le.monto });
      } else if (link.monto !== le.monto) {
        report('HIGH', 'monto_mismatch',
          `budget ${budgetId} linkedEjecucion monto ${le.monto} ≠ budgetLink monto ${link.monto}`,
          { companyId, budgetId, ejecucionId: le.ejecucionId, expected: le.monto, actual: link.monto });
      }
    }

    // Check: budgetLinks has entries not in linkedEjecuciones
    for (const fe of fromLinks) {
      const match = fromBudget.find(le => le.ejecucionId === fe.ejecucionId);
      if (!match) {
        report('HIGH', 'missing_linked_ejecucion',
          `budgetLink existe para ${fe.ejecucionId} pero budget.linkedEjecuciones no lo incluye`,
          { companyId, budgetId, ejecucionId: fe.ejecucionId, monto: fe.monto });
      }
    }
  }

  // ── 5. Para cada ejecucion, verificar montoAsignadoAcumulado vs suma de budgetLinks ──
  for (const [ejecucionId, ejecucion] of ejecuciones) {
    const links = linksByEjecucion.get(ejecucionId);
    const sumLinks = links ? Array.from(links.values()).reduce((s, l) => s + l.monto, 0) : 0;
    const storedAcumulado = ejecucion.montoAsignadoAcumulado ?? 0;

    if (sumLinks !== storedAcumulado) {
      report('HIGH', 'acumulado_mismatch',
        `ejecucion ${ejecucionId}: montoAsignadoAcumulado=${storedAcumulado} ≠ sum(budgetLinks)=${sumLinks}`,
        { companyId, ejecucionId, stored: storedAcumulado, computed: sumLinks, diff: storedAcumulado - sumLinks });
    }
  }

  // ── 6. BudgetLinks que apuntan a budgets/ejecuciones que no existen ──
  for (const [ejecucionId, links] of linksByEjecucion) {
    if (!ejecuciones.has(ejecucionId)) {
      report('HIGH', 'orphaned_link_ejecucion',
        `budgetLinks apuntan a ejecucion ${ejecucionId} que no existe`,
        { companyId, ejecucionId });
    }
    for (const [budgetId] of links) {
      if (!budgets.has(budgetId)) {
        report('MEDIUM', 'orphaned_link_budget',
          `budgetLink apunta a budget ${budgetId} que no existe`,
          { companyId, ejecucionId, budgetId });
      }
    }
  }

  // Stats
  totalBudgets += budgets.size;
  totalEjecuciones += ejecuciones.size;
  totalLinks += totalLinkDocs;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Auditoría de consistencia de budgetLinks');
  console.log('   Proyecto:', sa.project_id);

  const companyIds = await getCollectionIds('companies');

  if (companyIds.length === 0) {
    console.log('❌ No se encontraron empresas en la colección companies');
    return;
  }

  console.log(`   Empresas encontradas: ${companyIds.join(', ')}`);

  for (const companyId of companyIds) {
    await auditCompany(companyId);
  }

  // ── Report ──
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`   Presupuestos auditados:  ${totalBudgets}`);
  console.log(`   Ejecuciones auditadas:   ${totalEjecuciones}`);
  console.log(`   BudgetLinks encontrados: ${totalLinks}`);

  if (issues.length === 0) {
    console.log('\n✅ NO SE ENCONTRARON INCONSISTENCIAS. Datos consistentes.');
    return;
  }

  const high = issues.filter(i => i.severity === 'HIGH').length;
  const med = issues.filter(i => i.severity === 'MEDIUM').length;
  const low = issues.filter(i => i.severity === 'LOW').length;

  console.log(`\n⚠️  INCONSISTENCIAS ENCONTRADAS: ${issues.length}`);
  console.log(`   HIGH:   ${high}`);
  console.log(`   MEDIUM: ${med}`);
  console.log(`   LOW:    ${low}`);
  console.log('');

  for (const issue of issues) {
    const icon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🔵';
    console.log(`${icon} [${issue.severity}] ${issue.type}`);
    console.log(`   ${issue.description}`);
    console.log(`   ${JSON.stringify(issue.detail)}`);
    console.log('');
  }

  // Exit code
  if (high > 0) process.exitCode = 2;
  else if (med > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
