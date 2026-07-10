const { onRequest } = require('firebase-functions/v2/https');
const path = require('path');
const fs = require('fs');

/**
 * Cloud Function que sirve la app Next.js (SSR + API routes).
 *
 * Usa el build standalone ya compilado (.next/ + server.js) pero no ejecuta
 * server.js (que abre un puerto HTTP). En su lugar crea el request handler
 * de Next.js directamente apuntando a los archivos ya compilados.
 */
const standaloneDir = path.resolve(__dirname, 'standalone');
process.chdir(standaloneDir);
process.env.NODE_ENV = 'production';

// Leer la config de Next.js desde server.js y setearla como variable de entorno
const serverJsPath = path.join(standaloneDir, 'server.js');
const serverJs = fs.readFileSync(serverJsPath, 'utf-8');
const configMatch = serverJs.match(
  /const nextConfig\s*=\s*({[\s\S]*?});\s*\nprocess\.env\.__NEXT_PRIVATE_STANDALONE_CONFIG/,
);
if (configMatch) {
  const raw = configMatch[1].replace(/__dirname/g, JSON.stringify(standaloneDir));
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = raw;
}

const next = require('next');
const conf = JSON.parse(process.env.__NEXT_PRIVATE_STANDALONE_CONFIG || '{}');
const distDir = path.join(standaloneDir, '.next');

const app = next({ dev: false, dir: standaloneDir, conf: { ...conf, distDir } });
const handle = app.getRequestHandler();

let prepared = false;

exports.nextjs = onRequest(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
    concurrency: 80,
    cpu: 1,
    memory: '512MiB',
    secrets: ['SA_PRIVATE_KEY'],
    invoker: 'public',
  },
  async (req, res) => {
    if (!prepared) {
      await app.prepare();
      prepared = true;
    }
    return handle(req, res);
  },
);
