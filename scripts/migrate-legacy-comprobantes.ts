#!/usr/bin/env tsx
/**
 * migrate-legacy-comprobantes.ts
 *
 * Migrate legacy Ejecucion.comprobantes arrays to the new flat /documentos
 * collection (DocumentoMedio records). Non-destructive: leaves original
 * comprobantes arrays untouched.
 *
 * Usage:
 *   npx tsx scripts/migrate-legacy-comprobantes.ts            # emulator
 *   NODE_ENV=production npx tsx scripts/migrate-legacy-comprobantes.ts  # production
 */

import { Firestore } from 'firebase-admin/firestore';

// ─── Legacy tipo → TipoDocumentoMedio mapping ────────────────────────────

const LEGACY_TIPO_MAPPING: Record<string, string> = {
  'Comprobante de pago': 'comprobante_egreso',
  'Cuenta de Cobro': 'comprobante_ingreso',
};

interface LegacyComprobante {
  id: string;
  name: string;
  url: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: string;
  tipo?: string;
}

function mapLegacyTipo(tipo?: string): string | undefined {
  if (!tipo) return undefined;
  return LEGACY_TIPO_MAPPING[tipo] ?? 'otro';
}

// ─── Core Migration Function ─────────────────────────────────────────────

export async function migrateLegacyComprobantes(
  db: Firestore,
): Promise<{ migrated: number; companies: number; errors: string[] }> {
  const errors: string[] = [];
  let migrated = 0;
  let companies = 0;

  try {
    const companiesSnap = await db.collection('companies').get();
    companies = companiesSnap.size;

    for (const companyDoc of companiesSnap.docs) {
      const cId = companyDoc.id;

      try {
        const ejecucionesSnap = await db
          .collection('companies')
          .doc(cId)
          .collection('ejecuciones')
          .get();

        // Batch-oriented processing: collect all writes, then flush in chunks
        let batch = db.batch();
        let countInBatch = 0;
        const BATCH_FLUSH_AT = 400;

        for (const ejecucionDoc of ejecucionesSnap.docs) {
          const data = ejecucionDoc.data();
          const comprobantes: LegacyComprobante[] = data.comprobantes ?? [];
          const ejId = ejecucionDoc.id;

          for (const comprobante of comprobantes) {
            // Deterministic ID: legacy_{ejId}_{comprobanteId}
            // Guarantees idempotency — re-running the script overwrites
            // existing records instead of creating duplicates.
            const docId = `legacy_${ejId}_${comprobante.id}`;
            const docRef = db
              .collection('companies')
              .doc(cId)
              .collection('documentos')
              .doc(docId);

            const docData: Record<string, unknown> = {
              fileName: comprobante.name,
              storagePath: comprobante.path,
              url: comprobante.url,
              size: comprobante.size,
              mimeType: comprobante.type || 'application/pdf',
              status: 'enlazado',
              tipoDocumento: mapLegacyTipo(comprobante.tipo),
              ejecucionIds: [ejId],
              _source: 'migration',
              uploadedAt: comprobante.uploadedAt || new Date().toISOString(),
              createdBy: 'system',
              updatedAt: new Date().toISOString(),
            };

            batch.set(docRef, docData);
            countInBatch++;
            migrated++;

            if (countInBatch >= BATCH_FLUSH_AT) {
              await batch.commit();
              batch = db.batch();
              countInBatch = 0;
            }
          }
        }

        // Flush remaining batch
        if (countInBatch > 0) {
          await batch.commit();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Company ${cId}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Root: ${msg}`);
  }

  return { migrated, companies, errors };
}

// ─── Auto-run when executed directly ─────────────────────────────────────

const isDirectRun = process.argv.length >= 2 &&
  process.argv[1]?.includes('migrate-legacy-comprobantes');

if (isDirectRun) {
  (async () => {
    const { getApps, initializeApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (!getApps().length) {
      initializeApp();
    }

    const db = getFirestore();

    // If FIRESTORE_EMULATOR_HOST is set (local dev), configure
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
    }

    console.log('🚀 Starting legacy comprobantes migration...');
    const result = await migrateLegacyComprobantes(db);
    console.log(JSON.stringify(result, null, 2));
    console.log(`✅ Migration complete: ${result.migrated} documentos created across ${result.companies} companies`);
    if (result.errors.length > 0) {
      console.error('❌ Errors:', result.errors);
      process.exit(1);
    }
    process.exit(0);
  })().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
