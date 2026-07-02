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

// Same normalize as migration script: lowercase + non-alphanumeric → '-'
const normalize = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '-');

const providers = [
  { name: 'Emanuel Barriga' },
  { name: 'Claudia Hurtado' },
  { name: 'Serge Ercey' },
  { name: 'Pácora Producciones' },
  { name: 'Alexis Loaiza' },
  { name: 'Giovanny Sabogal' },
  { name: 'Luis Moreira' },
  { name: 'Juan Francisco' },
  { name: 'Juan Martín Rincón' },
];

async function seed() {
  console.log('Seeding providers...\n');

  for (const p of providers) {
    const docId = normalize(p.name);
    await db.collection('providers').doc(docId).set({
      name: p.name,
      createdAt: new Date().toISOString(),
    });
    console.log(`  ${docId} → ${p.name}`);
  }

  console.log(`\n✓ ${providers.length} providers created in root /providers`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
