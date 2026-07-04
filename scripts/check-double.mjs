import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
  const snap = await getDocs(collection(db, 'companies', 'saman', 'budgets'));
  const budgets = snap.docs.map(d => ({ id: d.id, raw: d.data() }));

  // Find ALL budgets matching the description
  const matches = budgets.filter(b =>
    b.raw.projectName === 'Servicios Nube' && b.raw.montoPresupuestado === 164700 && b.raw.mesPresupuestado === 'Marzo'
  );

  console.log(`🔍 Encontrados ${matches.length} presupuestos que coinciden:\n`);
  for (const m of matches) {
    console.log(`ID: ${m.id}`);
    console.log(`   archivado: ${m.raw.archivado} (tipo: ${typeof m.raw.archivado})`);
    console.log(`   descripcion: "${m.raw.descripcion}"`);
    console.log(`   projectName: "${m.raw.projectName}"`);
    console.log(`   entityName: "${m.raw.entityName}"`);
    console.log(`   fechaPresupuestado: "${m.raw.fechaPresupuestado}"`);
    console.log(`   createdAt: ${m.raw.createdAt?.seconds ? new Date(m.raw.createdAt.seconds * 1000).toISOString() : 'unknown'}`);
    console.log();
  }

  // Check total count by archivado status
  const archived = budgets.filter(b => b.raw.archivado === true);
  console.log(`📊 Total archivados: ${archived.length}`);
  for (const a of archived) {
    console.log(`   ${a.id.slice(0, 10)} | proy="${a.raw.projectName}" | mes="${a.raw.mesPresupuestado}" | monto=${a.raw.montoPresupuestado}`);
  }
}

main().catch(console.error);
