import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);

// Conectar a emuladores si la variable de entorno está configurada
if (process.env.NEXT_PUBLIC_EMULATOR_HOST) {
  const host = process.env.NEXT_PUBLIC_EMULATOR_HOST;
  const [firestorePort, authPort] = (process.env.NEXT_PUBLIC_EMULATOR_PORTS || '8081,9099').split(',').map(Number);
  connectFirestoreEmulator(db, host, firestorePort);
  // Storage emulator no siempre está disponible, intentar conectar
  try { connectStorageEmulator(storage, host, 9199); } catch {}
}
