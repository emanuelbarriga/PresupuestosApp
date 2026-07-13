const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Usamos la ruta absoluta exacta que ya verificamos que funciona
const rutaClave = '/Users/emanuel/Documents/ADMINISTRATIVO/Saman/gestor-de-presupuestos/cuentaDeServicio/clave.json';
const serviceAccount = JSON.parse(fs.readFileSync(rutaClave, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function exportarEstructura() {
  console.log("🚀 Conectando con Firestore (PlanningSaman)...");
  const estructuraGlobal = {};
  
  // Obtenemos todas las colecciones raíz
  const colecciones = await db.listCollections();
  
  for (const col of colecciones) {
    console.log(`📦 Descargando datos de la colección: [${col.id}]...`);
    estructuraGlobal[col.id] = {};
    
    // Traemos los documentos de esa colección
    const snapshot = await col.get();
    snapshot.forEach(doc => {
      estructuraGlobal[col.id][doc.id] = doc.data();
    });
  }

  // Guardamos todo en el archivo JSON
  fs.writeFileSync('./mi_estructura.json', JSON.stringify(estructuraGlobal, null, 2));
  console.log("\n✅ ¡Listo! El archivo 'mi_estructura.json' se ha creado con éxito.");
}

exportarEstructura().catch(console.error);
