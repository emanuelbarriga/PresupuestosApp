#!/usr/bin/env tsx
/**
 * garbage-collector-media.ts
 *
 * Clean up orphaned and abandoned documents in Storage and Firestore.
 *
 * Operations:
 * 1. Cross-reference: list files in Storage `companies/{cId}/documentos/`
 *    → query all `storagePath` in Firestore → delete phantom files
 *    (files in Storage without a matching Firestore record).
 * 2. Clean abandoned drafts: `_source == 'ejecucion-form' AND status ==
 *    'por_clasificar' AND uploadedAt < now-24h` → delete Firestore +
 *    Storage.
 * 3. Clean stale: `status: por_clasificar` older than 30d with no
 *    ejecucionIds (not linked to any ejecucion).
 *
 * Usage:
 *   npx tsx scripts/garbage-collector-media.ts                    # emulator (dry-run)
 *   npx tsx scripts/garbage-collector-media.ts --apply            # emulator (apply)
 *   NODE_ENV=production npx tsx scripts/garbage-collector-media.ts --apply  # production
 */

import { Firestore } from 'firebase-admin/firestore';
import { Bucket } from '@google-cloud/storage';

// ─── Result Types ────────────────────────────────────────────────────────

export interface GarbageCollectorResult {
  phantomFilesDeleted: number;
  abandonedDraftsDeleted: number;
  staleUnlinkedDeleted: number;
  storageFilesFound: number;
  firestoreRecordsFound: number;
  errors: string[];
}

// ─── Phantom File Cleanup ────────────────────────────────────────────────

/**
 * Cross-reference: list all files in Storage at `companies/{cId}/documentos/`
 * and delete files that do not have a matching Firestore DocumentoMedio record.
 * Uses paginated getFiles to avoid OOM on large buckets.
 */
async function cleanupPhantomFiles(
  db: Firestore,
  bucket: Bucket,
  apply: boolean,
  errors: string[],
): Promise<{ deleted: number; storageFilesFound: number; firestoreRecordsFound: number }> {
  let deleted = 0;
  let storageFilesFound = 0;
  let firestoreRecordsFound = 0;

  try {
    const companiesSnap = await db.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const cId = companyDoc.id;
      const prefix = `companies/${cId}/documentos/`;

      try {
        // Get all Firestore storagePaths for this company
        const docsSnap = await db
          .collection('companies')
          .doc(cId)
          .collection('documentos')
          .get();

        const firestorePaths = new Set<string>();
        docsSnap.forEach((d) => {
          const data = d.data();
          if (data.storagePath) {
            firestorePaths.add(data.storagePath as string);
          }
        });
        firestoreRecordsFound += firestorePaths.size;

        // Paginated listing to prevent OOM on large buckets
        let pageToken: string | undefined;
        do {
          const [files, getFilesResponse] = await bucket.getFiles({
            prefix,
            maxResults: 1000,
            pageToken,
          });

          // getFilesResponse has a pageToken property for pagination
          type GetFilesResponse = { pageToken?: string };
          const response = getFilesResponse as GetFilesResponse | undefined;
          storageFilesFound += files.length;

          for (const file of files) {
            const storagePath = file.name;
            if (firestorePaths.has(storagePath)) continue;
            if (apply) {
              await file.delete();
            }
            deleted++;
            if (!apply) {
              console.log(`  [DRY-RUN] Would delete phantom: ${storagePath}`);
            }
          }

          pageToken = response?.pageToken as string | undefined;
        } while (pageToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Cleanup phantom (${cId}): ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Root (phantom): ${msg}`);
  }

  return { deleted, storageFilesFound, firestoreRecordsFound };
}

// ─── Abandoned Draft Cleanup ─────────────────────────────────────────────

interface DocumentoSnapshot {
  id: string;
  data: () => Record<string, unknown>;
  ref: { delete: () => Promise<void> };
}

/**
 * Clean abandoned drafts: `_source == 'ejecucion-form' AND status ==
 * 'por_clasificar' AND uploadedAt < now-24h`.
 * Deletes both Firestore record and Storage file.
 * Uses batched writes to stay within Firestore limits.
 */
async function cleanupAbandonedDrafts(
  db: Firestore,
  bucket: Bucket,
  now: Date,
  apply: boolean,
  errors: string[],
): Promise<number> {
  let deleted = 0;
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const BATCH_FLUSH_AT = 400;

  try {
    const companiesSnap = await db.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const cId = companyDoc.id;

      try {
        const docsSnap = await db
          .collection('companies')
          .doc(cId)
          .collection('documentos')
          .get();

        let batch = db.batch();
        let countInBatch = 0;

        for (const docSnap of docsSnap.docs) {
          const data = docSnap.data();

          if (data._source !== 'ejecucion-form') continue;
          if (data.status !== 'por_clasificar') continue;
          if (!data.uploadedAt || data.uploadedAt >= cutoff24h) continue;

          // Delete Storage file
          if (data.storagePath && apply) {
            try {
              const file = bucket.file(data.storagePath as string);
              const [exists] = await file.exists();
              if (exists) {
                await file.delete();
              }
            } catch {
              // File may already be deleted — ignore
            }
          }

          // Queue Firestore delete in batch
          if (apply) {
            batch.delete(docSnap.ref);
            countInBatch++;
            if (countInBatch >= BATCH_FLUSH_AT) {
              await batch.commit();
              batch = db.batch();
              countInBatch = 0;
            }
          }

          deleted++;

          if (!apply) {
            console.log(`  [DRY-RUN] Would delete abandoned draft: ${cId}/documentos/${docSnap.id} (${data.storagePath})`);
          }
        }

        if (apply && countInBatch > 0) {
          await batch.commit();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Cleanup abandoned drafts (${cId}): ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Root (abandoned): ${msg}`);
  }

  return deleted;
}

// ─── Stale Unlinked Cleanup ──────────────────────────────────────────────

/**
 * Clean stale documents: `status: por_clasificar` older than 30d with no
 * ejecucionIds (never linked to any ejecucion).
 * Uses batched writes to stay within Firestore limits.
 */
async function cleanupStaleUnlinked(
  db: Firestore,
  bucket: Bucket,
  now: Date,
  apply: boolean,
  errors: string[],
): Promise<number> {
  let deleted = 0;
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const BATCH_FLUSH_AT = 400;

  try {
    const companiesSnap = await db.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const cId = companyDoc.id;

      try {
        const docsSnap = await db
          .collection('companies')
          .doc(cId)
          .collection('documentos')
          .get();

        let batch = db.batch();
        let countInBatch = 0;

        for (const docSnap of docsSnap.docs) {
          const data = docSnap.data();

          if (data.status !== 'por_clasificar') continue;
          if (!data.uploadedAt || data.uploadedAt >= cutoff30d) continue;

          const ejecucionIds = (data.ejecucionIds ?? []) as unknown[];
          if (ejecucionIds.length > 0) continue;

          // Delete Storage file
          if (data.storagePath && apply) {
            try {
              const file = bucket.file(data.storagePath as string);
              const [exists] = await file.exists();
              if (exists) {
                await file.delete();
              }
            } catch {
              // File may already be deleted
            }
          }

          // Queue Firestore delete in batch
          if (apply) {
            batch.delete(docSnap.ref);
            countInBatch++;
            if (countInBatch >= BATCH_FLUSH_AT) {
              await batch.commit();
              batch = db.batch();
              countInBatch = 0;
            }
          }

          deleted++;

          if (!apply) {
            console.log(`  [DRY-RUN] Would delete stale unlinked: ${cId}/documentos/${docSnap.id} (${data.storagePath})`);
          }
        }

        if (apply && countInBatch > 0) {
          await batch.commit();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Cleanup stale unlinked (${cId}): ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Root (stale): ${msg}`);
  }

  return deleted;
}

// ─── Main GC Function ────────────────────────────────────────────────────

/**
 * Run all garbage collection operations.
 *
 * @param db - Firestore instance
 * @param bucket - Storage Bucket instance
 * @param options.dryRun - If true, only report what would be deleted without deleting
 * @param options.now - Current date (for testability)
 */
export async function garbageCollectMedia(
  db: Firestore,
  bucket: Bucket,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<GarbageCollectorResult> {
  const apply = !(options.dryRun ?? true); // Default to dry-run for safety
  const now = options.now ?? new Date();
  const errors: string[] = [];

  const phantom = await cleanupPhantomFiles(db, bucket, apply, errors);
  const abandonedDraftsDeleted = await cleanupAbandonedDrafts(db, bucket, now, apply, errors);
  const staleUnlinkedDeleted = await cleanupStaleUnlinked(db, bucket, now, apply, errors);

  return {
    phantomFilesDeleted: phantom.deleted,
    abandonedDraftsDeleted,
    staleUnlinkedDeleted,
    storageFilesFound: phantom.storageFilesFound,
    firestoreRecordsFound: phantom.firestoreRecordsFound,
    errors,
  };
}

// ─── Auto-run when executed directly ─────────────────────────────────────

const isDirectRun = process.argv.length >= 2 &&
  process.argv[1]?.includes('garbage-collector-media');

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

    const bucket = getStorage().bucket();
    const apply = process.argv.includes('--apply');

    console.log(`🧹 Starting garbage collection (${apply ? 'APPLY' : 'DRY-RUN'})...`);
    const result = await garbageCollectMedia(db, bucket, { dryRun: !apply });
    console.log(JSON.stringify(result, null, 2));
    console.log(`✅ GC complete: ${result.phantomFilesDeleted} phantom files, ${result.abandonedDraftsDeleted} abandoned drafts, ${result.staleUnlinkedDeleted} stale unlinked`);
    if (result.errors.length > 0) {
      console.error('❌ Errors:', result.errors);
      process.exit(1);
    }
    process.exit(0);
  })().catch((err) => {
    console.error('GC failed:', err);
    process.exit(1);
  });
}
