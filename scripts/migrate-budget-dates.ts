import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.resolve(
  __dirname, '..',
  'planningsaman-3cf7e-firebase-adminsdk-fbsvc-2ddc38ebca.json',
);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function deriveFechaPresupuestado(
  mesPresupuestado: string | undefined,
  createdAt: Timestamp | string | undefined,
): string | null {
  // Try createdAt first: extract YYYY-MM from timestamp
  if (createdAt) {
    let date: Date;
    if (typeof createdAt === 'object' && 'toDate' in createdAt) {
      date = (createdAt as Timestamp).toDate();
    } else if (typeof createdAt === 'string') {
      date = new Date(createdAt);
    } else {
      date = new Date();
    }
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  }

  // Fallback: use current year + mesPresupuestado
  if (!mesPresupuestado) return null;
  const monthIndex = MONTHS.indexOf(mesPresupuestado);
  if (monthIndex === -1) return null;
  const year = new Date().getFullYear();
  const m = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${m}`;
}

async function migrate() {
  console.log('Starting migration: backfill fechaPresupuestado...');

  const companiesSnap = await db.collection('companies').get();
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    console.log(`\nCompany: ${companyId}`);

    const budgetsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('budgets')
      .get();

    let companyUpdated = 0;
    let companySkipped = 0;

    for (const budgetDoc of budgetsSnap.docs) {
      const data = budgetDoc.data();

      // Skip if already has fechaPresupuestado
      if (data.fechaPresupuestado) {
        companySkipped++;
        continue;
      }

      const mesPresupuestado: string | undefined = data.mesPresupuestado;
      const createdAt: Timestamp | undefined = data.createdAt;

      const fechaPresupuestado = deriveFechaPresupuestado(mesPresupuestado, createdAt);

      if (!fechaPresupuestado) {
        console.warn(
          `  ⚠ Skipping ${budgetDoc.id}: unable to derive fechaPresupuestado ` +
          `(mesPresupuestado="${mesPresupuestado}", createdAt=${createdAt})`,
        );
        continue;
      }

      await budgetDoc.ref.set(
        { fechaPresupuestado },
        { merge: true },
      );
      companyUpdated++;
      console.log(
        `  ✓ ${budgetDoc.id}: ${data.descripcion || '(no desc)'} → ${fechaPresupuestado}`,
      );
    }

    totalUpdated += companyUpdated;
    totalSkipped += companySkipped;
    console.log(
      `  → ${companyUpdated} updated, ${companySkipped} already had fechaPresupuestado`,
    );
  }

  console.log(
    `\nMigration complete: ${totalUpdated} budgets updated, ${totalSkipped} skipped.`,
  );
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
