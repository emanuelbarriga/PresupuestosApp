#!/usr/bin/env tsx
/**
 * link-ejecuciones-movimientos.ts
 *
 * Match ALL ejecuciones against ALL movimientos by cuentaId + fecha + valor.
 * Uses description similarity as tiebreaker for conflicts.
 * Updates BOTH sides: movimiento gets _ejecucionId + convertido, ejecucion gets _movimientoId + _extractoId.
 *
 * Uso:
 *   # Dry-run (default)
 *   npx tsx scripts/link-ejecuciones-movimientos.ts --production
 *
 *   # Apply — escribe TODAS las relaciones encontradas
 *   npx tsx scripts/link-ejecuciones-movimientos.ts --production --apply
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Args ──
const APPLY = process.argv.includes('--apply');
const PRODUCTION = process.argv.includes('--production');

// ── Init Firebase Admin ──
if (!PRODUCTION) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
}

const adminApp = initializeApp({
  projectId: 'planningsaman-3cf7e',
}, 'link-ejecuciones-mov');
const db = getFirestore(adminApp);

if (!PRODUCTION) {
  db.settings({ host: 'localhost:8081', ssl: false });
}

// ── Constants ──
const COMPANIES = 'companies';
const EJECUCIONES = 'ejecuciones';
const CUENTAS = 'cuentasBancarias';
const EXTRACTOS = 'extractos';
const MOVIMIENTOS = 'movimientos';

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

/** Simple description similarity: normalized substring match */
function descSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ' ').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ' ').trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Count matching words
  const wa = na.split(/\s+/).filter(Boolean);
  const wb = nb.split(/\s+/).filter(Boolean);
  const intersection = wa.filter(w => wb.includes(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 ? intersection / union : 0;
}

interface ExecucionDoc {
  id: string;
  _companyId: string;
  cuentaId?: string;
  cuentaName?: string;
  montoEjecutado: number;
  fechaEjecutado: string;
  tipo: string;
  descripcion: string;
  _movimientoId?: string;
  _extractoId?: string;
}

interface MovimientoDoc {
  id: string;
  extractoId: string;
  fecha: string;
  descripcion: string;
  debito?: number;
  credito?: number;
  saldo: number;
  convertido?: boolean;
  _ejecucionId?: string;
}

interface MatchResult {
  ejecucion: ExecucionDoc;
  movimiento: MovimientoDoc;
  companyId: string;
  cuentaId: string;
  similarity: number;
}

// ── Main ──
async function main() {
  log('🔗 Link Ejecuciones ↔ Movimientos — Matching completo');
  log(`   Modo: ${APPLY ? '✍️  APLICAR cambios' : '👀 Solo dry-run'}`);
  log(`   Entorno: ${PRODUCTION ? '🚀 PRODUCCIÓN' : '🧪 Emulator'}`);
  log('');

  // 1. Get ALL ejecuciones
  log('📥 Leyendo ejecuciones...');
  const ejecucionesSnap = await db.collectionGroup(EJECUCIONES).get();
  const ejecuciones: ExecucionDoc[] = [];
  ejecucionesSnap.forEach(doc => {
    const data = doc.data() as any;
    const companyId = doc.ref.path.split('/')[1];
    ejecuciones.push({
      id: doc.id,
      _companyId: companyId,
      cuentaId: data.cuentaId,
      cuentaName: data.cuentaName,
      montoEjecutado: data.montoEjecutado,
      fechaEjecutado: data.fechaEjecutado,
      tipo: data.tipo,
      descripcion: data.descripcion || '',
      _movimientoId: data._movimientoId,
      _extractoId: data._extractoId,
    });
  });
  log(`   → ${ejecuciones.length} ejecuciones totales`);

  const conCuenta = ejecuciones.filter(e => e.cuentaId);
  log(`   → ${conCuenta.length} con cuentaId`);

  const yaVinculadas = conCuenta.filter(e => e._movimientoId);
  log(`   → ${yaVinculadas.length} ya tienen _movimientoId (se skipean)`);

  const aProcesar = conCuenta.filter(e => !e._movimientoId);
  log(`   → ${aProcesar.length} para procesar`);
  log('');

  // 2. Group by companyId + cuentaId
  const porCuenta = new Map<string, ExecucionDoc[]>();
  for (const ej of aProcesar) {
    const key = `${ej._companyId}/${ej.cuentaId}`;
    if (!porCuenta.has(key)) porCuenta.set(key, []);
    porCuenta.get(key)!.push(ej);
  }

  log(`📂 Cuentas a procesar: ${porCuenta.size}`);
  log('');

  // 3. For each cuenta, get extractos + movimientos, then match
  let totalMatches = 0;
  let totalCollisions = 0;
  let totalNoMatch = 0;
  const matches: MatchResult[] = [];

  for (const [key, ejecs] of porCuenta) {
    const [companyId, cuentaId] = key.split('/');
    log(`   Cuenta: ${cuentaId.slice(0, 12)}... (${ejecs.length} ejecuciones)`);

    // Get extractos
    const extractosSnap = await db
      .collection(COMPANIES).doc(companyId)
      .collection(CUENTAS).doc(cuentaId)
      .collection(EXTRACTOS).get();

    const allMovimientos: Array<MovimientoDoc> = [];
    const extractoIds: string[] = [];
    extractosSnap.forEach(d => extractoIds.push(d.id));

    for (const extractoId of extractoIds) {
      const movsSnap = await db
        .collection(COMPANIES).doc(companyId)
        .collection(CUENTAS).doc(cuentaId)
        .collection(EXTRACTOS).doc(extractoId)
        .collection(MOVIMIENTOS).get();

      movsSnap.forEach(d => {
        const data = d.data();
        allMovimientos.push({
          id: d.id,
          extractoId,
          fecha: data.fecha || '',
          descripcion: data.descripcion || '',
          debito: data.debito,
          credito: data.credito,
          saldo: data.saldo,
          convertido: data.convertido,
          _ejecucionId: data._ejecucionId,
        });
      });
    }

    log(`     Extractos: ${extractoIds.length}, Movimientos: ${allMovimientos.length}`);

    // Match each ejecucion
    for (const ej of ejecs) {
      // Find candidates by fecha + valor
      const candidates = allMovimientos.filter(m => {
        if (m.fecha !== ej.fechaEjecutado) return false;
        const montoMov = ej.tipo === 'egreso' ? m.debito : m.credito;
        return montoMov === ej.montoEjecutado;
      });

      if (candidates.length === 0) {
        log(`     ❌ SIN MATCH: ${ej.descripcion.slice(0, 40)} — ${formatCOP(ej.montoEjecutado)} @ ${ej.fechaEjecutado}`);
        totalNoMatch++;
        continue;
      }

      if (candidates.length === 1) {
        const mov = candidates[0];
        log(`     ✅ ${ej.descripcion.slice(0, 40).padEnd(42)} ${formatCOP(ej.montoEjecutado).padStart(12)} @ ${ej.fechaEjecutado}`);
        matches.push({ ejecucion: ej, movimiento: mov, companyId, cuentaId, similarity: 1 });
        totalMatches++;
        continue;
      }

      // Multiple candidates — use description tiebreaker
      const scored = candidates.map(m => ({
        mov: m,
        score: descSimilarity(ej.descripcion, m.descripcion),
      })).sort((a, b) => b.score - a.score);

      const best = scored[0];
      const second = scored[1];

      if (best.score > 0.5 && best.score > second.score + 0.2) {
        log(`     ✅ ${ej.descripcion.slice(0, 40).padEnd(42)} ${formatCOP(ej.montoEjecutado).padStart(12)} @ ${ej.fechaEjecutado} (desc: ${(best.score * 100).toFixed(0)}%)`);
        matches.push({ ejecucion: ej, movimiento: best.mov, companyId, cuentaId, similarity: best.score });
        totalMatches++;
      } else {
        log(`     ⚠️  COLISIÓN: ${ej.descripcion.slice(0, 30)} — ${candidates.length} candidatos:`);
        for (const s of scored.slice(0, 3)) {
          log(`        └ ${s.mov.descripcion.slice(0, 40).padEnd(42)} (score: ${(s.score * 100).toFixed(0)}%)`);
        }
        totalCollisions++;
      }
    }
    log('');
  }

  // 4. Summary
  log('══════════════════════════════════════');
  log('📊 RESUMEN');
  log(`   ✅ Match:             ${totalMatches}`);
  log(`   ⚠️  Colisiones:        ${totalCollisions}`);
  log(`   ❌ Sin match:          ${totalNoMatch}`);
  log('');

  // 5. Apply
  if (APPLY && matches.length > 0) {
    log('✍️  Aplicando cambios (ambos lados)...');
    let ok = 0;
    let fail = 0;

    for (const match of matches) {
      const { ejecucion, movimiento, companyId, cuentaId } = match;

      try {
        // Update BOTH sides in parallel
        await Promise.all([
          // Movimiento → get _ejecucionId
          db
            .collection(COMPANIES).doc(companyId)
            .collection(CUENTAS).doc(cuentaId)
            .collection(EXTRACTOS).doc(movimiento.extractoId)
            .collection(MOVIMIENTOS).doc(movimiento.id)
            .update({
              convertido: true,
              _ejecucionId: ejecucion.id,
              _updatedAt: FieldValue.serverTimestamp(),
            }),
          // Ejecucion → get _movimientoId + _extractoId
          db
            .collection(COMPANIES).doc(companyId)
            .collection(EJECUCIONES).doc(ejecucion.id)
            .update({
              _movimientoId: movimiento.id,
              _extractoId: movimiento.extractoId,
              _updatedAt: FieldValue.serverTimestamp(),
            }),
        ]);

        log(`   ✅ ${ejecucion.id.slice(0, 8)} ↔ ${movimiento.id.slice(0, 8)} (${formatCOP(ejecucion.montoEjecutado)} @ ${ejecucion.fechaEjecutado})`);
        ok++;
      } catch (err) {
        log(`   ❌ Error: ${ejecucion.id} ↔ ${movimiento.id}:`, err);
        fail++;
      }
    }

    log('');
    log(`   Resultado: ${ok} vinculados, ${fail} errores`);
  } else if (!APPLY) {
    log('👀 Dry-run. Para aplicar: --apply --production');
    log('');
    if (matches.length > 0) {
      log('   Matches a escribir:');
      for (const m of matches.slice(0, 10)) {
        log(`   • ${m.ejecucion.descripcion.slice(0, 40).padEnd(42)} ↔ ${m.movimiento.descripcion.slice(0, 35)}`);
      }
      if (matches.length > 10) log(`   ... y ${matches.length - 10} más`);
    }
  }

  log('');
  log('🏁 Done.');
}

function log(...args: any[]) {
  console.log(...args);
}

main().catch(console.error);
