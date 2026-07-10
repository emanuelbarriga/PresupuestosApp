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

    // ── Fix: Next.js 15 standalone + Cloud Functions v2 body conflict ──
    //
    // Cloud Functions v2 consume el stream del body antes de que Next.js
    // pueda crear su NextRequest interno. Si Next.js recibe el body como
    // objeto parseado (req.body), el constructor de Request falla con:
    //   "Response body object should not be disturbed or locked"
    //
    // Solución: restaurar el body como string UTF-8 para que Next.js pueda
    // crear su propio ReadableStream. req.rawBody es un Buffer provisto
    // por Cloud Functions v2 con el body crudo original.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
        req.body = req.rawBody.toString('utf-8');
        req.headers['content-length'] = String(Buffer.byteLength(req.body));
      } else if (req.body && typeof req.body === 'object') {
        // Fallback: si rawBody no está disponible, serializar el objeto
        req.body = JSON.stringify(req.body);
        req.headers['content-length'] = String(Buffer.byteLength(req.body));
      }
    }

    return handle(req, res);
  },
);
