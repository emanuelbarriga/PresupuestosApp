import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.resolve(
  __dirname, '..',
  'planningsaman-3cf7e-firebase-adminsdk-fbsvc-2ddc38ebca.json',
);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deleteCollection(path: string, batchSize = 50) {
  const snapshot = await db.collection(path).limit(batchSize).get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  const deleted = snapshot.size;
  console.log(`  Deleted ${deleted} docs from ${path}`);
  return deleted;
}

async function deleteSubCollection(companyId: string, sub: string, batchSize = 100) {
  const snapshot = await db
    .collection('companies').doc(companyId)
    .collection(sub).limit(batchSize).get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  const deleted = snapshot.size;
  console.log(`  Deleted ${deleted} docs from companies/${companyId}/${sub}`);
  return deleted;
}

async function cleanup() {
  console.log('Cleaning up test data...\n');

  // Root collections
  for (const col of ['clients', 'providers']) {
    let total = 0;
    let n = 0;
    do {
      n = await deleteCollection(col);
      total += n;
    } while (n > 0);
    if (total === 0) console.log(`  (empty) ${col}`);
    else console.log(`  → ${total} total from ${col}\n`);
  }

  // Company subcollections
  const companiesSnap = await db.collection('companies').get();
  for (const companyDoc of companiesSnap.docs) {
    const cid = companyDoc.id;
    console.log(`\nCompany: ${cid}`);

    for (const sub of ['budgets', 'ejecuciones', 'projects', 'clients', 'providers']) {
      let total = 0;
      let n = 0;
      do {
        n = await deleteSubCollection(cid, sub);
        total += n;
      } while (n > 0);
      if (total === 0) console.log(`  (empty) companies/${cid}/${sub}`);
      else console.log(`  → ${total} total from companies/${cid}/${sub}`);
    }
  }

  console.log('\nCleanup complete!');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
