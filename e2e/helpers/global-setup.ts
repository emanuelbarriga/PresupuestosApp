/**
 * Global setup for Playwright E2E tests.
 *
 * 1. Starts Firebase emulators (if not already running)
 * 2. Seeds test data into the emulator
 * 3. Creates a test auth user
 */
import { execSync, spawn } from 'child_process';
import * as http from 'http';

const EMULATOR_HOST = 'localhost';
const FS_PORT = 8081;
const AUTH_PORT = 9099;
const PROJECT_ID = 'planningsaman-3cf7e';

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${EMULATOR_HOST}:${port}`, () => {
      resolve(true);
      req.destroy();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function createAuthUser() {
  return new Promise<void>((resolve, reject) => {
    const payload = JSON.stringify({
      email: 'test@ejemplo.com',
      password: 'test123',
      returnSecureToken: true,
    });
    const req = http.request({
      hostname: EMULATOR_HOST,
      port: AUTH_PORT,
      path: `/identitytoolkit.googleapis.com/v1/accounts:signUp?key=any`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Auth user created (or already exists)');
          resolve();
        } else {
          // User may already exist, that's ok
          console.log(`⚠️ Auth response: ${res.statusCode} — ${body}`);
          resolve();
        }
      });
    });
    req.on('error', (err) => {
      // If user exists, it's ok
      console.log(`⚠️ Auth request error (may be OK): ${err.message}`);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function globalSetup() {
  console.log('\n🔧 E2E Global Setup\n');

  // ── 1. Check if emulators are running ──
  const fsRunning = await isPortOpen(FS_PORT);
  const authRunning = await isPortOpen(AUTH_PORT);

  if (!fsRunning || !authRunning) {
    console.log('🚀 Starting Firebase emulators...');
    
    const emulatorProcess = spawn('npx', [
      'firebase', 'emulators:start',
      '--project', PROJECT_ID,
      '--only', 'auth,firestore',
    ], {
      stdio: 'pipe',
      env: { ...process.env, JAVA_TOOL_OPTIONS: '-Xmx512m' },
    });

    // Wait for emulators to be ready
    let output = '';
    await new Promise<void>((resolve) => {
      emulatorProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
        if (output.includes('Emulator Hub running') || output.includes('All emulators ready')) {
          resolve();
        }
      });
      emulatorProcess.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
        if (output.includes('Emulator Hub running') || output.includes('All emulators ready')) {
          resolve();
        }
      });
      // Timeout after 30 seconds
      setTimeout(resolve, 30000);
    });

    console.log('✅ Emulators started');
  } else {
    console.log('✅ Emulators already running');
  }

  // ── 2. Create auth user ──
  await createAuthUser();

  // ── 3. Seed Firestore data ──
  console.log('🌱 Seeding test data...');
  try {
    execSync('npx tsx e2e/seed/seed-emulator.ts', {
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${FS_PORT}`,
        FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${AUTH_PORT}`,
      },
      timeout: 30000,
    });
    console.log('✅ Seed complete\n');
  } catch (err) {
    console.log('⚠️ Seed may have already been run, continuing...');
  }
}

export default globalSetup;
