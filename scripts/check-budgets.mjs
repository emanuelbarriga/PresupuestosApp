/**
 * Diagnostic: muestra budgets de una compañía con fechaPresupuestado
 * para ver por qué uno no aparece en el Dashboard.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      let key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = process.env[key] || value;
    }
  } catch { /* ignore */ }
}

loadEnv();

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

const db = getFirestore(app);
const companyId = 'saman';

async function main() {
  console.log(`\n📋 Presupuestos para company="${companyId}":\n`);
  const snap = await getDocs(collection(db, 'companies', companyId, 'budgets'));
  const budgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Ordenar por projectName
  budgets.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));

  for (const b of budgets) {
    const fp = b.fechaPresupuestado ?? '(vacio)';
    const arch = b.archivado ? '🔒 ARCHIVADO' : '         ';
    const fpOk = fp && fp.length > 0 && fp !== '(vacio)';
    const filterMatch = fpOk && fp.startsWith('2026');

    console.log(
      `${arch} ${b.id.slice(0, 8)}... | ` +
      `proy="${b.projectName}" | ` +
      `mes="${b.mesPresupuestado}" | ` +
      `fp="${fp}"${fpOk ? (filterMatch ? ' ✅' : ' ❌ año no coincide') : ' ❌ vacio'} | ` +
      `tipo=${b.tipo} | ` +
      `monto=${b.montoPresupuestado}`
    );
  }

  console.log(`\n📊 Total: ${budgets.length} presupuestos`);
  console.log(`   ✅ Con fechaPresupuestado valido: ${budgets.filter(b => b.fechaPresupuestado && b.fechaPresupuestado.startsWith('2026')).length}`);
  console.log(`   ❌ Sin fechaPresupuestado: ${budgets.filter(b => !b.fechaPresupuestado || b.fechaPresupuestado === '').length}`);
  console.log(`   🔒 Archivados: ${budgets.filter(b => b.archivado).length}`);
}

main().catch(console.error);
