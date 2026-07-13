#!/usr/bin/env tsx
/**
 * cleanup-collisions.ts
 *
 * 1. Re-run matching to find collision ejecuciones → delete them
 * 2. Set convertido: false on their candidate movimientos
 * 3. Find movimientos with convertido=true but no _ejecucionId → set convertido=false
 *
 * Uso:
 *   npx tsx scripts/cleanup-collisions.ts --production --apply
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const PRODUCTION = process.argv.includes('--production');

if (!PRODUCTION) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
}

const app = initializeApp({ projectId: 'planningsaman-3cf7e' }, 'cleanup-collisions');
const db = getFirestore(app);
if (!PRODUCTION) db.settings({ host: 'localhost:8081', ssl: false });

const COMPANIES = 'companies';
const CUENTAS = 'cuentasBancarias';
const EXTRACTOS = 'extractos';
const MOVIMIENTOS = 'movimientos';
const EJECUCIONES = 'ejecuciones';

function log(...args: any[]) { console.log(...args); }

function descSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ' ').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ' ').trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa = na.split(/\s+/).filter(Boolean);
  const wb = nb.split(/\s+/).filter(Boolean);
  const intersection = wa.filter(w => wb.includes(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 ? intersection / union : 0;
}

async function main() {
  log('🧹 Cleanup: colisiones + huérfanos convertido');
  log(`   Modo: ${APPLY ? '✍️  APLICAR' : '👀 Dry-run'}`);
  log(`   Entorno: ${PRODUCTION ? '🚀 PRODUCCIÓN' : '🧪 Emulator'}`);
  log('');

  // ── PART 1: Identify collisions ──
  log('📥 Leyendo ejecuciones...');
  const ejecucionesSnap = await db.collectionGroup(EJECUCIONES).get();
  interface E {
    id: string; companyId: string; cuentaId?: string; monto: number; fecha: string; tipo: string; desc: string;
  }
  const ejecuciones: E[] = [];
  ejecucionesSnap.forEach(d => {
    const data = d.data();
    const cid = d.ref.path.split('/')[1];
    ejecuciones.push({
      id: d.id, companyId: cid,
      cuentaId: data.cuentaId, monto: data.montoEjecutado ?? 0,
      fecha: data.fechaEjecutado ?? '', tipo: data.tipo ?? 'egreso',
      desc: data.descripcion ?? '',
    });
  });
  log(`   → ${ejecuciones.length} totales`);
  const conCuenta = ejecuciones.filter(e => e.cuentaId);
  log(`   → ${conCuenta.length} con cuentaId`);
  log('');

  // Group by cuenta
  const grouped = new Map<string, E[]>();
  for (const ej of conCuenta) {
    const key = `${ej.companyId}/${ej.cuentaId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ej);
  }

  log('🔍 Buscando colisiones...');
  const toDelete: Array<{ ejecucion: E; movimientos: Array<{ id: string; extractoId: string; desc: string }>; companyId: string; cuentaId: string }> = [];

  for (const [key, ejecs] of grouped) {
    const [companyId, cuentaId] = key.split('/');

    const extractosSnap = await db.collection(COMPANIES).doc(companyId).collection(CUENTAS).doc(cuentaId).collection(EXTRACTOS).get();
    const allMovs: Array<{ id: string; extractoId: string; fecha: string; desc: string; debito?: number; credito?: number }> = [];
    for (const ext of extractosSnap.docs) {
      const movsSnap = await ext.ref.collection(MOVIMIENTOS).get();
      movsSnap.forEach(d => {
        const dd = d.data();
        allMovs.push({ id: d.id, extractoId: ext.id, fecha: dd.fecha, desc: dd.descripcion ?? '', debito: dd.debito, credito: dd.credito });
      });
    }

    for (const ej of ejecs) {
      const cands = allMovs.filter(m => {
        if (m.fecha !== ej.fecha) return false;
        const monto = ej.tipo === 'egreso' ? m.debito : m.credito;
        return monto === ej.monto;
      });
      if (cands.length <= 1) continue;

      const scored = cands.map(m => ({ mov: m, score: descSimilarity(ej.desc, m.desc) })).sort((a, b) => b.score - a.score);
      const best = scored[0], second = scored[1];
      if (best.score > 0.5 && best.score > second.score + 0.2) continue;

      toDelete.push({
        ejecucion: ej,
        movimientos: cands.map(c => ({ id: c.id, extractoId: c.extractoId, desc: c.desc })),
        companyId, cuentaId,
      });
    }
  }

  log(`   → ${toDelete.length} colisiones encontradas`);
  log('');

  // ── PART 2: Find orphan convertido=true movimientos ──
  log('🔍 Buscando movimientos con convertido=true sin _ejecucionId...');
  const orphanMovs: Array<{ id: string; extractoId: string; companyId: string; cuentaId: string; desc: string }> = [];

  const processedCuentas = new Set<string>();
  for (const item of grouped.keys()) {
    if (processedCuentas.has(item)) continue;
    processedCuentas.add(item);

    const [companyId, cuentaId] = item.split('/');
    const extractosSnap = await db.collection(COMPANIES).doc(companyId).collection(CUENTAS).doc(cuentaId).collection(EXTRACTOS).get();

    for (const ext of extractosSnap.docs) {
      const movsSnap = await ext.ref.collection(MOVIMIENTOS).get();
      movsSnap.forEach(d => {
        const dd = d.data();
        if (dd.convertido === true && !dd._ejecucionId) {
          orphanMovs.push({
            id: d.id, extractoId: ext.id, companyId, cuentaId,
            desc: dd.descripcion ?? '',
          });
        }
      });
    }
  }

  log(`   → ${orphanMovs.length} movimientos huérfanos encontrados`);
  log('');

  // ── Summary ──
  log('══════════════════════════════════════');
  log('📊 RESUMEN');
  log(`   🗑️  Ejecuciones a borrar:    ${toDelete.length}`);
  log(`   🔄 Movs candidatos a false: ${toDelete.reduce((s, c) => s + c.movimientos.length, 0)}`);
  log(`   🔄 Movs huérfanos a false:  ${orphanMovs.length}`);
  log('');

  if (!APPLY) {
    log('👀 Dry-run. Acciones:');
    for (const item of toDelete) {
      log(`   🗑️  ${item.ejecucion.id.slice(0, 8)} — ${item.ejecucion.desc.slice(0, 40).padEnd(42)} $${item.ejecucion.monto} — ${item.movimientos.length} candidatos`);
    }
    log('');
    for (const m of orphanMovs.slice(0, 10)) {
      log(`   🔄 ${m.id.slice(0, 8)} — ${m.desc.slice(0, 40)} (huérfano)`);
    }
    if (orphanMovs.length > 10) log(`   ... y ${orphanMovs.length - 10} más`);
    log('');
    log('   Para aplicar: --apply --production');
    return;
  }

  // ── APPLY ──
  log('✍️  Aplicando...');
  let okDel = 0, failDel = 0, okMov = 0, failMov = 0, okOrphan = 0, failOrphan = 0;

  // Delete ejecuciones + reset candidate movimientos
  for (const item of toDelete) {
    try {
      await db.collection(COMPANIES).doc(item.companyId).collection(EJECUCIONES).doc(item.ejecucion.id).delete();
      okDel++;
    } catch (e) {
      log(`   ❌ Error borrando ${item.ejecucion.id}:`, e);
      failDel++;
    }

    for (const mov of item.movimientos) {
      try {
        await db.collection(COMPANIES).doc(item.companyId)
          .collection(CUENTAS).doc(item.cuentaId)
          .collection(EXTRACTOS).doc(mov.extractoId)
          .collection(MOVIMIENTOS).doc(mov.id)
          .update({ convertido: false, _ejecucionId: FieldValue.delete(), _updatedAt: FieldValue.serverTimestamp() });
        okMov++;
      } catch (e) {
        log(`   ❌ Error reseteando movimiento ${mov.id}:`, e);
        failMov++;
      }
    }
  }

  // Reset orphan movimientos
  for (const mov of orphanMovs) {
    try {
      await db.collection(COMPANIES).doc(mov.companyId)
        .collection(CUENTAS).doc(mov.cuentaId)
        .collection(EXTRACTOS).doc(mov.extractoId)
        .collection(MOVIMIENTOS).doc(mov.id)
        .update({ convertido: false, _ejecucionId: FieldValue.delete(), _updatedAt: FieldValue.serverTimestamp() });
      okOrphan++;
    } catch (e) {
      log(`   ❌ Error reseteando huérfano ${mov.id}:`, e);
      failOrphan++;
    }
  }

  log('');
  log('══════════════════════════════════════');
  log('📊 RESULTADO');
  log(`   🗑️  Ejecuciones borradas:     ${okDel} ok, ${failDel} fail`);
  log(`   🔄 Movs candidatos false:   ${okMov} ok, ${failMov} fail`);
  log(`   🔄 Movs huérfanos false:    ${okOrphan} ok, ${failOrphan} fail`);
  log('🏁 Done.');
}

main().catch(console.error);
