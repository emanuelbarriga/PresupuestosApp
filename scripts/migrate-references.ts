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

async function migrate() {
  console.log('Migrating entity references...');

  const companiesSnap = await db.collection('companies').get();
  let totalBudgets = 0;
  let totalEjecuciones = 0;
  let skippedBudgets = 0;
  let skippedEjecuciones = 0;
  let updatedBudgets = 0;
  let updatedEjecuciones = 0;

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    console.log(`\nCompany: ${companyId}`);

    // Normalize names like seed.ts does: lowercase + strip non-alphanumeric
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Build name→ID maps for this company
    const projectMap = new Map<string, string>(); // name → id
    const allProjectIds = new Set<string>(); // all valid project IDs
    const projectsSnap = await db.collection('companies').doc(companyId).collection('projects').get();
    projectsSnap.forEach(doc => {
      const data = doc.data();
      allProjectIds.add(doc.id);
      if (data.name) projectMap.set(data.name, doc.id);
    });

    // Clients and providers are at root collections (matching app subscriptions)
    const clientMap = new Map<string, string>(); // name → id
    const clientNormalizedMap = new Map<string, string>();
    const clientsSnap = await db.collection('clients').get();
    clientsSnap.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        clientMap.set(data.name, doc.id);
        clientNormalizedMap.set(normalize(data.name), doc.id);
      }
    });

    const providerMap = new Map<string, string>(); // name → id
    const providerNormalizedMap = new Map<string, string>();
    const providersSnap = await db.collection('providers').get();
    providersSnap.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        providerMap.set(data.name, doc.id);
        providerNormalizedMap.set(normalize(data.name), doc.id);
      }
    });

    // Also check subcollection clients/providers (legacy data model)
    const subClientsSnap = await db.collection('companies').doc(companyId).collection('clients').get();
    subClientsSnap.forEach(doc => {
      const data = doc.data();
      if (data.name && !clientMap.has(data.name)) {
        clientMap.set(data.name, doc.id);
        clientNormalizedMap.set(normalize(data.name), doc.id);
      }
    });

    const subProvidersSnap = await db.collection('companies').doc(companyId).collection('providers').get();
    subProvidersSnap.forEach(doc => {
      const data = doc.data();
      if (data.name && !providerMap.has(data.name)) {
        providerMap.set(data.name, doc.id);
        providerNormalizedMap.set(normalize(data.name), doc.id);
      }
    });

    // Resolve helpers
    const resolveProjectId = (name: string): string => {
      // Priority 1: if a project doc has the normalized name as its ID, use it (survives renames)
      const docId = normalize(name);
      if (allProjectIds.has(docId)) return docId;
      // Priority 2: exact name match (sidepanel-created projects with auto-generated IDs)
      return projectMap.get(name) || '';
    };
    const resolveEntity = (name: string): { entityId: string; entityType: string } => {
      const n = normalize(name);
      const clientId = clientMap.get(name) || clientNormalizedMap.get(n);
      if (clientId) return { entityId: clientId, entityType: 'client' };
      const providerId = providerMap.get(name) || providerNormalizedMap.get(n);
      if (providerId) return { entityId: providerId, entityType: 'provider' };
      return { entityId: '', entityType: '' };
    };

    // Process budgets
    const budgetsSnap = await db.collection('companies').doc(companyId).collection('budgets').get();
    totalBudgets += budgetsSnap.size;

    for (const doc of budgetsSnap.docs) {
      const data = doc.data();

      // Skip only if already migrated AND the project still exists
      if (data.projectId && allProjectIds.has(data.projectId)) {
        skippedBudgets++;
        continue;
      }

      const updates: Record<string, any> = {};

      const projectName = data.projectName || data.proyectoAsignado || '';
      const projectId = resolveProjectId(projectName);
      updates.projectId = projectId;
      updates.projectName = projectName;

      const entityName = data.entityName || data.clienteOProveedor || '';

      if (entityName && entityName !== 'Interno' && entityName !== 'interno') {
        const { entityId, entityType } = resolveEntity(entityName);
        updates.entityId = entityId;
        updates.entityType = entityType;
        updates.entityName = entityName;
      } else if (entityName === 'Interno' || entityName === 'interno') {
        updates.entityId = '';
        updates.entityType = 'interno';
        updates.entityName = 'Interno';
      }

      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
        updatedBudgets++;
        if (updates.projectId || updates.entityId) {
          console.log(`  Budget ${doc.id}: projectId="${updates.projectId}", entityId="${updates.entityId}", entityType="${updates.entityType}"`);
        }
      }
    }

    // Process ejecuciones
    const ejecucionesSnap = await db.collection('companies').doc(companyId).collection('ejecuciones').get();
    totalEjecuciones += ejecucionesSnap.size;

    for (const doc of ejecucionesSnap.docs) {
      const data = doc.data();

      // Skip only if already migrated AND the project still exists
      if (data.projectId && allProjectIds.has(data.projectId)) {
        skippedEjecuciones++;
        continue;
      }

      const updates: Record<string, any> = {};

      const projectName = data.projectName || data.proyectoAsignado || '';
      const projectId = resolveProjectId(projectName);
      updates.projectId = projectId;
      updates.projectName = projectName;

      const entityName = data.entityName || data.clienteOProveedor || '';

      if (entityName && entityName !== 'Interno' && entityName !== 'interno') {
        const { entityId, entityType } = resolveEntity(entityName);
        updates.entityId = entityId;
        updates.entityType = entityType;
        updates.entityName = entityName;
      } else if (entityName === 'Interno' || entityName === 'interno') {
        updates.entityId = '';
        updates.entityType = 'interno';
        updates.entityName = 'Interno';
      }

      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
        updatedEjecuciones++;
        if (updates.projectId || updates.entityId) {
          console.log(`  Ejecucion ${doc.id}: projectId="${updates.projectId}", entityId="${updates.entityId}", entityType="${updates.entityType}"`);
        }
      }
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Budgets: ${totalBudgets} total, ${skippedBudgets} skipped (already migrated), ${updatedBudgets} updated`);
  console.log(`Ejecuciones: ${totalEjecuciones} total, ${skippedEjecuciones} skipped, ${updatedEjecuciones} updated`);
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
