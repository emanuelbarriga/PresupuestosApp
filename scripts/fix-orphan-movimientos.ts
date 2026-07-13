#!/usr/bin/env tsx
/**
 * fix-orphan-movimientos.ts
 *
 * Busca ejecuciones con cuentaId que NO tienen su movimiento bancario marcado como
 * convertido. Las asocia automáticamente por: cuentaId + fecha + monto.
 *
 * Uso:
 *   # Modo dry-run (default) — solo muestra lo que haría
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/fix-orphan-movimientos.ts
 *
 *   # Modo real (ejecuta cambios)
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/fix-orphan-movimientos.ts --apply
 *
 *   # Producción (sin emulator — requiere credenciales ADC configuradas)
 *   npx tsx scripts/fix-orphan-movimientos.ts --apply --production
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
}, 'fix-orphan-movimientos');
const db = getFirestore(adminApp);

if (!PRODUCTION) {
  db.settings({ host: 'localhost:8081', ssl: false });
}

// ── Helpers ──
const COMPANIES = 'companies';
const EJECUCIONES = 'ejecuciones';
const CUENTAS = 'cuentasBancarias';
const EXTRACTOS = 'extractos';
const MOVIMIENTOS = 'movimientos';

function log(...args: any[]) {
  console.log(...args);
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

// ── Types ──
interface EjecucionDoc {
  id: string;
  cuentaId?: string;
  cuentaName?: string;
  montoEjecutado: number;
  fechaEjecutado: string;
  tipo: string;
  descripcion: string;
  [key: string]: any;
}

interface MovimientoDoc {
  id: string;
  fecha: string;
  descripcion: string;
  debito?: number;
  credito?: number;
  saldo: number;
  convertido?: boolean;
  _ejecucionId?: string;
  [key: string]: any;
}

interface MatchResult {
  ejecucion: EjecucionDoc;
  movimiento: MovimientoDoc;
  extractoId: string;
  cuentaId: string;
}

// ── Main ──
async function main() {
  log('🔍 Fix Orphan Movimientos — Script de matching automático');
  log(`   Modo: ${APPLY ? '✍️  APLICAR cambios' : '👀 Solo dry-run (usá --apply para escritura)'}`);
  log(`   Entorno: ${PRODUCTION ? '🚀 PRODUCCIÓN' : '🧪 Emulator'}`);
  log('');

  // 1. Get ALL ejecuciones
  log('📥 Leyendo ejecuciones...');
  const ejecucionesSnap = await db.collectionGroup(EJECUCIONES).get();
  const ejecuciones: EjecucionDoc[] = [];
  ejecucionesSnap.forEach(doc => {
    const data = doc.data() as EjecucionDoc;
    // Extract companyId from the doc path: companies/{companyId}/ejecuciones/{id}
    const companyId = doc.ref.path.split('/')[1];
    ejecuciones.push({ ...data, id: doc.id, _companyId: companyId });
  });
  log(`   → ${ejecuciones.length} ejecuciones totales`);

  // Filter: only those with cuentaId set
  const conCuenta = ejecuciones.filter(e => e.cuentaId);
  log(`   → ${conCuenta.length} con cuentaId seteado`);
  log('');

  // 2. Group ejecuciones by companyId + cuentaId for efficient querying
  const cuentasMap = new Map<string, Set<string>>(); // "companyId/cuentaId" -> Set<companyId/cuentaId>
  const ejecucionesPorCuenta = new Map<string, EjecucionDoc[]>(); // "companyId/cuentaId" -> ejecuciones[]

  for (const ej of conCuenta) {
    const key = `${ej._companyId}/${ej.cuentaId}`;
    if (!ejecucionesPorCuenta.has(key)) {
      ejecucionesPorCuenta.set(key, []);
    }
    ejecucionesPorCuenta.get(key)!.push(ej);
  }

  log(`📂 Cuentas bancarias involucradas: ${ejecucionesPorCuenta.size}`);
  log('');

  // 3. For each cuenta, get extractos and movimientos
  let totalMatched = 0;
  let totalCollisions = 0;
  let totalNoMatch = 0;
  const matches: MatchResult[] = [];

  for (const [key, ejecs] of ejecucionesPorCuenta) {
    const [companyId, cuentaId] = key.split('/');
    log(`   Cuenta: ${cuentaId} (${ejecs.length} ejecuciones) — ${ejecs[0].cuentaName || ''}`);

    // Get extractos for this cuenta
    const extractosSnap = await db
      .collection(COMPANIES)
      .doc(companyId)
      .collection(CUENTAS)
      .doc(cuentaId)
      .collection(EXTRACTOS)
      .get();

    const extractoIds: string[] = [];
    extractosSnap.forEach(doc => extractoIds.push(doc.id));
    log(`     Extractos: ${extractoIds.length}`);

    // For each extracto, get movimientos
    const allMovimientos: Array<MovimientoDoc & { extractoId: string }> = [];
    for (const extractoId of extractoIds) {
      const movsSnap = await db
        .collection(COMPANIES)
        .doc(companyId)
        .collection(CUENTAS)
        .doc(cuentaId)
        .collection(EXTRACTOS)
        .doc(extractoId)
        .collection(MOVIMIENTOS)
        .get();

      movsSnap.forEach(doc => {
        const data = doc.data() as MovimientoDoc;
        allMovimientos.push({ ...data, id: doc.id, extractoId });
      });
    }
    log(`     Movimientos totales: ${allMovimientos.length}`);
    const unconverted = allMovimientos.filter(m => !m.convertido);
    log(`     Sin convertir: ${unconverted.length}`);

    // 4. Match each ejecucion against movimientos
    for (const ej of ejecs) {
      const candidates = unconverted.filter(m => {
        // Match by fecha
        if (m.fecha !== ej.fechaEjecutado) return false;
        // Match by monto (tipo-aware)
        const montoEj = ej.montoEjecutado;
        if (ej.tipo === 'egreso') {
          return m.debito === montoEj;
        } else {
          return m.credito === montoEj;
        }
      });

      if (candidates.length === 1) {
        // Perfect match!
        const mov = candidates[0];
        log(`     ✅ ${ej.descripcion || '(sin desc)'} → ${formatCOP(ej.montoEjecutado)} @ ${ej.fechaEjecutado}`);
        matches.push({
          ejecucion: ej,
          movimiento: mov,
          extractoId: mov.extractoId,
          cuentaId,
        });
        totalMatched++;
      } else if (candidates.length > 1) {
        log(`     ⚠️  COLISIÓN: ${ej.descripcion || '(sin desc)'} — ${candidates.length} movimientos coinciden (fecha: ${ej.fechaEjecutado}, monto: ${formatCOP(ej.montoEjecutado)})`);
        for (const c of candidates) {
          log(`        └ ${c.id} — ${c.descripcion} (${c.debito ? 'D' : 'C'}: ${formatCOP(c.debito || c.credito || 0)})`);
        }
        totalCollisions++;
      } else {
        log(`     ❌ SIN MATCH: ${ej.descripcion || '(sin desc)'} — ${formatCOP(ej.montoEjecutado)} @ ${ej.fechaEjecutado} (cuenta: ${ej.cuentaName || ej.cuentaId})`);
        totalNoMatch++;
      }
    }
    log('');
  }

  // 5. Summary
  log('══════════════════════════════════════');
  log('📊 RESUMEN');
  log(`   ✅ Match exacto:        ${totalMatched}`);
  log(`   ⚠️  Colisiones:          ${totalCollisions}`);
  log(`   ❌ Sin match:            ${totalNoMatch}`);
  log('');

  // 6. Apply
  if (APPLY && matches.length > 0) {
    log('✍️  Aplicando cambios...');
    let ok = 0;
    let fail = 0;

    for (const match of matches) {
      const { ejecucion, movimiento, extractoId, cuentaId } = match;
      const companyId = ejecucion._companyId;

      try {
        await db
          .collection(COMPANIES)
          .doc(companyId)
          .collection(CUENTAS)
          .doc(cuentaId)
          .collection(EXTRACTOS)
          .doc(extractoId)
          .collection(MOVIMIENTOS)
          .doc(movimiento.id)
          .update({
            convertido: true,
            _ejecucionId: ejecucion.id,
            _updatedAt: FieldValue.serverTimestamp(),
          });
        log(`   ✅ ${ejecucion.id} → movimiento ${movimiento.id} vinculado`);
        ok++;
      } catch (err) {
        log(`   ❌ Error actualizando ${movimiento.id}:`, err);
        fail++;
      }
    }

    log('');
    log(`   Resultado: ${ok} vinculados, ${fail} errores`);
  } else if (!APPLY && matches.length > 0) {
    log('👀 Dry-run: no se escribieron cambios. Para aplicar, ejecutá con --apply');
    log('');
    log('   Para ver el detalle completo de cada match:');
    for (const match of matches) {
      log(`   • ${match.ejecucion.id} ← ${match.movimiento.descripcion} (${match.cuentaId}/${match.extractoId}/${match.movimiento.id})`);
    }
  }

  if (totalNoMatch > 0) {
    log('');
    log('💡 Las ejecuciones SIN MATCH pueden ser:');
    log('   • Creadas manualmente sin relación con un movimiento bancario');
    log('   • Montos que no coinciden exactamente (ej: comisiones, retenciones)');
    log('   • Movimientos en otra cuenta no vinculada');
    log('   Para esas, revisión manual recomendada.');
  }

  log('');
  log('🏁 Done.');
}

main().catch(console.error);
