#!/usr/bin/env tsx
/**
 * down-migration-media.ts
 *
 * Reverse migration for safe rollback.
 * For each DocumentoMedio with ejecucionIds, copies back to
 * Ejecucion.comprobantes array and duplicates Storage file for each
 * linked ejecucion (prevents domino effect if old system deletes files
 * on ejecucion delete).
 *
 * Usage:
 *   npx tsx scripts/down-migration-media.ts                    # emulator
 *   NODE_ENV=production npx tsx scripts/down-migration-media.ts # production
 */

import { Firestore } from 'firebase-admin/firestore';
import { Bucket } from '@google-cloud/storage';

interface DocumentoMedioRecord {
  id: string;
  fileName: string;
  storagePath: string;
  url: string;
  size: number;
  mimeType: string;
  status: string;
  tipoDocumento?: string;
  ejecucionIds: string[];
  _source: string;
  uploadedAt: string;
  createdBy: string;
}

/**
 * Generate a legacy-style storage path for a comprobante.
 * Format: {companyId}/ejecuciones/{ejecucionId}/{uuid}-{sanitizedName}
 */
function generateLegacyStoragePath(
  companyId: string,
  ejecucionId: string,
  fileName: string,
): string {
  const uuid = crypto.randomUUID();
  const sanitized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${companyId}/ejecuciones/${ejecucionId}/${uuid}-${sanitized}`;
}

/**
 * Duplicate a Storage file from the flat /documentos path to a legacy
 * nested path under an ejecucion.
 * Returns true if the file was successfully duplicated, false if not found.
 */
async function duplicateStorageFile(
  bucket: Bucket,
  sourceStoragePath: string,
  destStoragePath: string,
): Promise<boolean> {
  const sourceFile = bucket.file(sourceStoragePath);
  const [exists] = await sourceFile.exists();
  if (!exists) {
    console.warn(`  ⚠ Source file not found in Storage: ${sourceStoragePath}`);
    return false;
  }
  await sourceFile.copy(bucket.file(destStoragePath));
  return true;
}

/**
 * Run down-migration: copy DocumentoMedio records back to Ejecucion.comprobantes
 * arrays and duplicate Storage files for rollback safety.
 */
export async function downMigrateMedia(
  db: Firestore,
  bucket: Bucket,
): Promise<{
  processed: number;
  comprobantesCreated: number;
  filesDuplicated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let comprobantesCreated = 0;
  let filesDuplicated = 0;

  try {
    const companiesSnap = await db.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const cId = companyDoc.id;

      try {
        // Get all DocumentoMedio records for this company
        const docsSnap = await db
          .collection('companies')
          .doc(cId)
          .collection('documentos')
          .get();

        for (const docSnap of docsSnap.docs) {
          const data = docSnap.data() as DocumentoMedioRecord;
          const ejecucionIds = data.ejecucionIds ?? [];

          if (ejecucionIds.length === 0) continue;

          processed++;

          for (const ejId of ejecucionIds) {
            try {
              // Generate legacy storage path for this ejecucion
              const legacyPath = generateLegacyStoragePath(cId, ejId, data.fileName);

              // Duplicate Storage file
              const duplicated = await duplicateStorageFile(bucket, data.storagePath, legacyPath);
              if (!duplicated) continue; // Skip comprobante creation if file not found
              filesDuplicated++;

              // Build a legacy comprobante entry
              const comprobanteEntry = {
                id: crypto.randomUUID(),
                name: data.fileName,
                url: data.url,
                path: legacyPath,
                type: data.mimeType || 'application/pdf',
                size: data.size,
                uploadedAt: data.uploadedAt,
                tipo: data.tipoDocumento,
              };

              // Append to Ejecucion.comprobantes array
              await db
                .collection('companies')
                .doc(cId)
                .collection('ejecuciones')
                .doc(ejId)
                .update({
                  comprobantes: (await getComprobantesArray(db, cId, ejId)).concat([comprobanteEntry]),
                });

              comprobantesCreated++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Company ${cId}, Documento ${docSnap.id}, Ejecucion ${ejId}: ${msg}`);
            }
          }
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

  return { processed, comprobantesCreated, filesDuplicated, errors };
}

/**
 * Read the current comprobantes array from an ejecucion.
 */
async function getComprobantesArray(
  db: Firestore,
  companyId: string,
  ejecucionId: string,
): Promise<unknown[]> {
  try {
    const ejSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('ejecuciones')
      .doc(ejecucionId)
      .get();
    const data = ejSnap.data();
    return data?.comprobantes ?? [];
  } catch {
    return [];
  }
}

// ─── Auto-run when executed directly ─────────────────────────────────────

const isDirectRun = process.argv.length >= 2 &&
  process.argv[1]?.includes('down-migration-media');

if (isDirectRun) {
  (async () => {
    const { getApps, initializeApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getStorage } = await import('firebase-admin/storage');

    if (!getApps().length) {
      initializeApp();
    }

    const db = getFirestore();
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
    }

    const bucket = getStorage().bucket(
      process.env.STORAGE_BUCKET || 'planningsaman-3cf7e.firebasestorage.app',
    );

    console.log('🔁 Starting down-migration...');
    const result = await downMigrateMedia(db, bucket);
    console.log(JSON.stringify(result, null, 2));
    console.log(`✅ Down-migration complete: ${result.comprobantesCreated} comprobantes created, ${result.filesDuplicated} files duplicated`);
    if (result.errors.length > 0) {
      console.error('❌ Errors:', result.errors);
      process.exit(1);
    }
    process.exit(0);
  })().catch((err) => {
    console.error('Down-migration failed:', err);
    process.exit(1);
  });
}
