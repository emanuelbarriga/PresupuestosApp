import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);

// Conectar al emulador de Auth si la variable de entorno está configurada
if (process.env.NEXT_PUBLIC_EMULATOR_HOST) {
  const host = process.env.NEXT_PUBLIC_EMULATOR_HOST;
  const ports = (process.env.NEXT_PUBLIC_EMULATOR_PORTS || '8081,9099').split(',').map(Number);
  const authPort = ports[1] || 9099;
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
}
