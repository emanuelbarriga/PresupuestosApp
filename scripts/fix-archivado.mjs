/**
 * Fix: convierte archivado="false" (string) → archivado: false (boolean)
 * y archivado="true" (string) → archivado: true (boolean)
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const line of readFileSync(resolve(__dirname, '..', '.env'), 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = process.env[t.slice(0, i).trim()] || v;
  }
}
loadEnv();

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function main() {
  // Fix budgets
  const snap = await getDocs(collection(db, 'companies', 'saman', 'budgets'));
  let fixed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const av = data.archivado;
    if (typeof av === 'string') {
      const boolVal = av === 'true';
      await updateDoc(doc(db, 'companies', 'saman', 'budgets', d.id), { archivado: boolVal });
      console.log(`  ✅ Budget ${d.id.slice(0, 10)}: "${av}" → ${boolVal}`);
      fixed++;
    } else if (av === undefined) {
      // Delete the field entirely so the subscriber defaults to false
      // Actually, let's set it to false explicitly for consistency
      await updateDoc(doc(db, 'companies', 'saman', 'budgets', d.id), { archivado: false });
      fixed++;
    }
  }
  console.log(`\n📊 Budgets fixed: ${fixed}`);

  // Fix ejecuciones
  const snap2 = await getDocs(collection(db, 'companies', 'saman', 'ejecuciones'));
  let fixed2 = 0;
  for (const d of snap2.docs) {
    const data = d.data();
    const av = data.archivado;
    if (typeof av === 'string') {
      const boolVal = av === 'true';
      await updateDoc(doc(db, 'companies', 'saman', 'ejecuciones', d.id), { archivado: boolVal });
      console.log(`  ✅ Ejecucion ${d.id.slice(0, 10)}: "${av}" → ${boolVal}`);
      fixed2++;
    } else if (av === undefined) {
      await updateDoc(doc(db, 'companies', 'saman', 'ejecuciones', d.id), { archivado: false });
      fixed2++;
    }
  }
  console.log(`\n📊 Ejecuciones fixed: ${fixed2}`);
  console.log(`\n✅ Total fixed: ${fixed + fixed2}`);
}

main().catch(console.error);
