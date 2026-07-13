/**
 * Escanea el árbol completo de Firestore: colecciones raíz + subcolecciones
 * sin bajar documentos (solo para no saturar).
 * Uso: node arbol-de-colecciones.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const rutaClave = '/Users/emanuel/Documents/ADMINISTRATIVO/Saman/gestor-de-presupuestos/cuentaDeServicio/clave.json';
const serviceAccount = JSON.parse(fs.readFileSync(rutaClave, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function explorarColeccion(coleccion, profundidad = 0) {
  const indent = '  '.repeat(profundidad);
  const docs = await coleccion.get();
  const docCount = docs.size;
  console.log(`${indent}📁 ${coleccion.id} (${docCount} docs)`);

  if (docCount === 0) return;

  // Por cada documento, buscar subcolecciones (solo las primeras 2 para no saturar)
  let subCount = 0;
  for (const doc of docs.docs) {
    const subCols = await doc.ref.listCollections();
    for (const sub of subCols) {
      subCount++;
      if (subCount <= 10) {
        await explorarColeccion(sub, profundidad + 1);
      }
    }
    // Solo revisamos los primeros 2 docs para subcolecciones
    if (subCount > 10) break;
  }

  if (subCount > 10) {
    console.log(`${indent}  ... y ${subCount - 10} subcolecciones más`);
  }
}

async function main() {
  console.log('🌳 Árbol completo de Firestore\n');

  const colecciones = await db.listCollections();
  for (const col of colecciones) {
    await explorarColeccion(col);
  }

  console.log('\n✅ Escaneo completo');
}

main().catch(console.error);
