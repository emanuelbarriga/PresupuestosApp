/**
 * Migration: backfill fechaPresupuestado for budgets missing it.
 *
 * Reads all budgets across all companies; for budgets where
 * fechaPresupuestado is empty/missing, derives the year from
 * createdAt (or current year as fallback) and sets
 * fechaPresupuestado = "${year}-${monthIndex + 1}".
 *
 * Usage: node scripts/migrate-fechapresupuestado.mjs
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (dotenv is available in the project)
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
  } catch {
    console.warn('⚠️  No .env file found, using process.env');
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('❌ NEXT_PUBLIC_FIREBASE_PROJECT_ID not set. Check .env');
  process.exit(1);
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getCompanies() {
  const snapshot = await getDocs(collection(db, 'companies'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getBudgets(companyId) {
  const snapshot = await getDocs(collection(db, 'companies', companyId, 'budgets'));
  return snapshot.docs.map(d => {
    const data = d.data();
    return { id: d.id, ...data };
  });
}

function deriveYear(doc) {
  // Try createdAt first (most reliable)
  if (doc.createdAt) {
    if (typeof doc.createdAt.toDate === 'function') {
      return doc.createdAt.toDate().getFullYear();
    }
    if (doc.createdAt.seconds) {
      return new Date(doc.createdAt.seconds * 1000).getFullYear();
    }
  }
  // Try fechaEjecutado if present (YYYY-MM-DD)
  if (doc.fechaEjecutado && typeof doc.fechaEjecutado === 'string') {
    const y = parseInt(doc.fechaEjecutado.split('-')[0], 10);
    if (!isNaN(y) && y > 2000) return y;
  }
  // Fallback: current year
  return new Date().getFullYear();
}

let totalMigrated = 0;
let totalSkipped = 0;
let errors = [];

async function main() {
  console.log('🔍 Starting migration: backfill fechaPresupuestado...\n');

  const companies = await getCompanies();
  console.log(`📋 Found ${companies.length} companies\n`);

  for (const company of companies) {
    const budgets = await getBudgets(company.id);
    console.log(`  Company "${company.id}": ${budgets.length} budgets`);

    for (const b of budgets) {
      const hasFecha = b.fechaPresupuestado && typeof b.fechaPresupuestado === 'string' && b.fechaPresupuestado.length > 0;

      if (hasFecha) {
        totalSkipped++;
        continue;
      }

      if (!b.mesPresupuestado || typeof b.mesPresupuestado !== 'string') {
        console.warn(`    ⚠️  Budget ${b.id} has no mesPresupuestado — skipping`);
        totalSkipped++;
        continue;
      }

      const monthIdx = MONTHS.indexOf(b.mesPresupuestado);
      if (monthIdx === -1) {
        console.warn(`    ⚠️  Budget ${b.id} has unknown mesPresupuestado "${b.mesPresupuestado}" — skipping`);
        totalSkipped++;
        continue;
      }

      const year = deriveYear(b);
      const fechaPresupuestado = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

      try {
        await updateDoc(doc(db, 'companies', company.id, 'budgets', b.id), { fechaPresupuestado });
        console.log(`    ✅ ${b.id} → ${fechaPresupuestado} (${b.mesPresupuestado} ${year})`);
        totalMigrated++;
      } catch (err) {
        console.error(`    ❌ ${b.id}: ${err.message}`);
        errors.push({ id: b.id, company: company.id, error: err.message });
      }
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`   ✅ ${totalMigrated} budgets updated`);
  console.log(`   ⏭️  ${totalSkipped} budgets skipped (already have fechaPresupuestado or missing mesPresupuestado)`);
  if (errors.length > 0) {
    console.log(`   ❌ ${errors.length} errors:`);
    errors.forEach(e => console.log(`      - ${e.company}/${e.id}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
