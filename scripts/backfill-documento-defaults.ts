#!/usr/bin/env tsx
/**
 * backfill-documento-defaults.ts
 *
 * One-time script that backfills default values for existing `enlazado` documents
 * that are missing `periodo` or `tipoDocumento`. Also syncs `_linkedDocumentos`
 * on the linked ejecuciones so their entries also get the defaults.
 *
 * MUST be run BEFORE deploying the hardened Firestore rules (T4), otherwise
 * documents without periodo/tipoDocumento would become immutable.
 *
 * Uses Admin SDK — bypasses Firestore security rules.
 *
 * Usage:
 *   npx tsx scripts/backfill-documento-defaults.ts                # all companies
 *   npx tsx scripts/backfill-documento-defaults.ts <companyId>    # single company
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function backfillDocumentoDefaults(companyId?: string) {
  let totalDocumentosUpdated = 0;
  let totalEjecucionesUpdated = 0;

  // Resolve companies to process
  let companyDocs: FirebaseFirestore.DocumentSnapshot[] = [];

  if (companyId) {
    const doc = await db.collection('companies').doc(companyId).get();
    if (doc.exists) {
      companyDocs = [doc];
    } else {
      console.error(`Company not found: ${companyId}`);
      process.exit(1);
    }
  } else {
    const snap = await db.collection('companies').get();
    companyDocs = snap.docs;
  }

  for (const companyDoc of companyDocs) {
    const cId = companyDoc.id;
    const docsSnap = await db
      .collection(`companies/${cId}/documentos`)
      .where('status', '==', 'enlazado')
      .get();

    if (docsSnap.empty) {
      console.log(`No enlazado documents for company: ${cId}`);
      continue;
    }

    let batch = db.batch();
    let batchCount = 0;
    let companyUpdated = 0;

    for (const doc of docsSnap.docs) {
      const data = doc.data();
      const updates: Record<string, string> = {};
      const needsPeriodo = !data.periodo;
      const needsTipoDoc = !data.tipoDocumento;

      if (needsPeriodo) updates.periodo = 'sin_periodo';
      if (needsTipoDoc) updates.tipoDocumento = 'otro';

      if (Object.keys(updates).length === 0) continue;

      // 1. Update the document itself
      batch.update(doc.ref, updates);
      companyUpdated++;
      batchCount++;

      // 2. Sync _linkedDocumentos on all linked ejecuciones
      const ejecucionIds: string[] = data.ejecucionIds ?? [];
      for (const ejId of ejecucionIds) {
        const ejRef = db.collection(`companies/${cId}/ejecuciones`).doc(ejId);
        const ejSnap = await ejRef.get();

        if (!ejSnap.exists) continue;

        const ejData = ejSnap.data() ?? {};
        const linkedDocs: Array<Record<string, any>> = ejData._linkedDocumentos ?? [];
        const updatedLinked = linkedDocs.map((entry) =>
          entry.documentoId === doc.id
            ? {
                ...entry,
                periodo: needsPeriodo ? 'sin_periodo' : (entry.periodo ?? 'sin_periodo'),
                tipoDocumento: needsTipoDoc ? 'otro' : (entry.tipoDocumento ?? 'otro'),
              }
            : entry,
        );

        batch.update(ejRef, { _linkedDocumentos: updatedLinked });
        totalEjecucionesUpdated++;
        batchCount++;
      }

      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`Batch committed: ${batchCount} ops (${cId})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Batch committed: ${batchCount} ops (${cId})`);
    }

    totalDocumentosUpdated += companyUpdated;
    console.log(`Company ${cId}: ${companyUpdated} documentos actualizados`);
  }

  console.log(`\nTotal documentos actualizados: ${totalDocumentosUpdated}`);
  console.log(`Total ejecuciones sincronizadas: ${totalEjecucionesUpdated}`);
}

// ── CLI entry ──
const targetCompany = process.argv[2];
backfillDocumentoDefaults(targetCompany).catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
