import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI } from '@google/genai';
import { getAdminApp, getAdminStorage } from '@/lib/firebase-admin';
import path from 'path';

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5_242_880; // 5 MB
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const OCR_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    proveedorTexto: { type: 'string', nullable: true },
    nit: { type: 'string', nullable: true },
    fechaDocumento: { type: 'string', nullable: true },
    montoTotal: { type: 'number', nullable: true },
    tipoDocumentoSugerido: {
      type: 'string',
      nullable: true,
      description: 'Tipo de documento: factura_venta, factura_compra, extracto_bancario, comprobante_egreso, comprobante_ingreso, planilla, contrato, otro',
    },
    descripcion: {
      type: 'string',
      nullable: true,
      description: 'Descripción del documento o texto relevante extraído (ej. concepto, notas, referencias)',
    },
  },
  required: ['proveedorTexto', 'nit', 'fechaDocumento', 'montoTotal'],
};

function buildPrompt(context?: {
  tipoDocumento?: string;
  terceroCount?: number;
  proyectoCount?: number;
}): string {
  const tipo = context?.tipoDocumento
    ? `${context.tipoDocumento} colombiano`
    : 'factura o comprobante colombiano';

  const stats = [];
  if (context?.terceroCount && context.terceroCount > 0) {
    stats.push(`${context.terceroCount} proveedores registrados`);
  }
  if (context?.proyectoCount && context.proyectoCount > 0) {
    stats.push(`${context.proyectoCount} proyectos activos`);
  }

  const statsLine = stats.length > 0
    ? `\nEl sistema tiene ${stats.join(' y ')}. Devolvé el nombre EXACTO del proveedor tal como aparece en el sistema para facilitar el matching automático.\n`
    : '\n';

  return `Extraé los siguientes datos de este ${tipo}:${statsLine}- proveedorTexto: nombre del proveedor o emisor (EXACTO para matching automático)
- nit: NIT del proveedor (formato XX.XXX.XXX-X o XXXXXXXXX-X)
- fechaDocumento: fecha del documento en formato YYYY-MM-DD
- montoTotal: monto total del documento (solo números, sin símbolos)
- tipoDocumentoSugerido: clasificá el documento en UNO de estos tipos según su contenido (devolvé null si no estás seguro):
  - factura_venta: factura de venta o factura de compra
  - factura_compra: factura de compra
  - extracto_bancario: extracto bancario o estado de cuenta
  - comprobante_egreso: comprobante de egreso, recibo de pago
  - comprobante_ingreso: comprobante de ingreso, recibo de cobro
  - planilla: planilla, nómina
  - contrato: contrato
  - otro: cualquier otro tipo de documento
- descripcion: texto relevante del documento como concepto, descripción, referencias, notas, números de factura, o cualquier información textual importante que pueda servir para identificar el documento

Si un campo no es visible o no se puede determinar, devolvé null.`;
}

// ─── Logger ─────────────────────────────────────────────────────────────

const LOG_PREFIX = '[OCR-API]';

function log(step: string, ...args: unknown[]) {
  console.log(`${LOG_PREFIX} ${step}:`, ...args);
}

function logError(step: string, ...args: unknown[]) {
  console.error(`${LOG_PREFIX} ❌ ${step}:`, ...args);
}

function logSuccess(step: string, ...args: unknown[]) {
  console.log(`${LOG_PREFIX} ✅ ${step}:`, ...args);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getMimeFromExtension(storagePath: string): string | null {
  const ext = path.extname(storagePath).toLowerCase();
  log('Extension check', `storagePath="${storagePath}" -> ext="${ext}"`);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    log('Extension rejected', `"${ext}" not in allowed set`);
    return null;
  }
  const mime = EXTENSION_MIME_MAP[ext];
  log('Extension accepted', `"${ext}" -> MIME "${mime}"`);
  return mime;
}

function isGoogleApiError(err: unknown): err is Error & { status?: number } {
  return err instanceof Error && 'status' in err;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Gemini caller with retry ────────────────────────────────────────────

async function callGeminiWithRetry(
  client: GoogleGenAI,
  base64Data: string,
  mimeType: string,
  promptText: string,
): Promise<unknown> {
  const dataSizeKB = (base64Data.length / 1024).toFixed(1);
  const content = [
    { text: promptText },
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
  ];

  const makeCall = (attempt: number) => {
    const model = 'gemini-3.1-flash-lite';
    log('Gemini request', `Attempt #${attempt} | model="${model}" | mimeType="${mimeType}" | base64Size="${dataSizeKB}KB"`);
    return client.models.generateContent({
      model,
      contents: content,
      config: { responseJsonSchema: OCR_JSON_SCHEMA },
    });
  };

  try {
    const result = await makeCall(1);
    const text = result.text;
    log('Gemini raw response text', text ? `"${text.slice(0, 200)}..."` : 'EMPTY');
    if (!text) throw new Error('Empty response from Gemini');
    const parsed = JSON.parse(text);
    logSuccess('Gemini parse OK', JSON.stringify(parsed));
    return parsed;
  } catch (error) {
    if (isGoogleApiError(error) && error.status === 429) {
      log('Gemini 429 rate limit', 'Waiting 1s and retrying...');
      await sleep(1000);
      try {
        const result = await makeCall(2);
        const retryText = result.text;
        log('Gemini retry raw response text', retryText ? `"${retryText.slice(0, 200)}..."` : 'EMPTY');
        if (!retryText) throw new Error('Empty response from Gemini on retry');
        const parsed = JSON.parse(retryText);
        logSuccess('Gemini retry parse OK', JSON.stringify(parsed));
        return parsed;
      } catch (retryError) {
        if (isGoogleApiError(retryError) && retryError.status === 429) {
          logError('Gemini retry also 429', 'Propagating 429 to client');
          throw retryError;
        }
        logError('Gemini retry failed', retryError instanceof Error ? retryError.message : String(retryError));
        throw retryError;
      }
    }
    logError('Gemini first call failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ status: 'live', message: 'OCR extract route is alive' });
}

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString(36);
  log(`[${requestId}] === NEW OCR REQUEST ===`);
  log(`[${requestId}] Method: ${request.method}`);
  log(`[${requestId}] URL: ${request.url}`);

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    log(`[${requestId}] Step 1/6: Authentication`);
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logError(`[${requestId}] Auth FAILED`, 'Missing or invalid Authorization header');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const tokenPreview = `${authHeader.slice(7, 22)}...`;
    log(`[${requestId}] Auth token present`, `"${tokenPreview}"`);
    const adminAuth = getAuth(getAdminApp());
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      logSuccess(`[${requestId}] Auth OK`, `uid="${decoded.uid}" email="${decoded.email || 'N/A'}"`);
    } catch (err) {
      logError(`[${requestId}] Auth FAILED`, err instanceof Error ? err.message : String(err));
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────────
    log(`[${requestId}] Step 2/6: Parse request body`);
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      log(`[${requestId}] Body parsed`, `keys=[${Object.keys(body).join(', ')}]`);
    } catch {
      logError(`[${requestId}] Body parse FAILED`, 'Invalid JSON');
      return NextResponse.json({ error: 'storagePath requerido' }, { status: 400 });
    }

    // Reject tokens in body
    if (body.authToken) {
      logError(`[${requestId}] Token in body REJECTED`, 'Auth token must be in Authorization header only');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { storagePath, tipoDocumento, terceroCount, proyectoCount } = body as {
      storagePath?: string;
      tipoDocumento?: string;
      terceroCount?: number;
      proyectoCount?: number;
    };
    if (!storagePath || typeof storagePath !== 'string') {
      logError(`[${requestId}] storagePath missing or invalid`, `type=${typeof storagePath} value=${storagePath}`);
      return NextResponse.json({ error: 'storagePath requerido' }, { status: 400 });
    }
    log(`[${requestId}] storagePath`, `"${storagePath}"`);
    log(`[${requestId}] Context`, `tipo="${tipoDocumento || 'auto'}" terceros=${terceroCount ?? 0} proyectos=${proyectoCount ?? 0}`);

    // ── Extension validation ──────────────────────────────────────────
    log(`[${requestId}] Step 3/6: Validate file extension`);
    const mimeType = getMimeFromExtension(storagePath);
    if (!mimeType) {
      logError(`[${requestId}] Extension REJECTED`, `"${path.extname(storagePath).toLowerCase()}" not supported`);
      return NextResponse.json(
        { error: 'Formato no soportado. Usá PDF, PNG o JPG.' },
        { status: 400 },
      );
    }
    logSuccess(`[${requestId}] Extension OK`, `MIME="${mimeType}"`);

    // ── File fetch from Storage ──────────────────────────────────────
    log(`[${requestId}] Step 4/6: Fetch file from Firebase Storage`);
    let fileBuffer: Buffer;
    try {
      const adminStorage = getAdminStorage();
      const bucket = adminStorage.bucket();
      log(`[${requestId}] Storage bucket`, bucket.name || '(default)');
      const fileRef = bucket.file(storagePath);
      
      log(`[${requestId}] Checking file existence: "${storagePath}"`);
      const [exists] = await fileRef.exists();
      if (!exists) {
        logError(`[${requestId}] File NOT FOUND in Storage`, `"${storagePath}"`);
        return NextResponse.json({ error: `Archivo no encontrado en Storage: ${storagePath}` }, { status: 404 });
      }
      logSuccess(`[${requestId}] File exists in Storage`);
      
      log(`[${requestId}] Downloading file...`);
      const [data] = await fileRef.download();
      fileBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      logSuccess(`[${requestId}] File downloaded`, `${(fileBuffer.length / 1024).toFixed(1)}KB`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`[${requestId}] Storage fetch FAILED`, message);
      return NextResponse.json({ error: `Error al acceder al archivo: ${message}` }, { status: 404 });
    }

    // ── Size guard ────────────────────────────────────────────────────
    log(`[${requestId}] Step 5/6: Validate file size`);
    const fileSizeKB = (fileBuffer.length / 1024).toFixed(1);
    const maxSizeKB = (MAX_FILE_SIZE / 1024).toFixed(1);
    log(`[${requestId}] File size`, `${fileSizeKB}KB / ${maxSizeKB}KB max`);
    if (fileBuffer.length > MAX_FILE_SIZE) {
      logError(`[${requestId}] File TOO LARGE`, `${fileSizeKB}KB > ${maxSizeKB}KB`);
      return NextResponse.json(
        { error: 'El archivo excede el límite de 5MB' },
        { status: 413 },
      );
    }
    logSuccess(`[${requestId}] Size OK`, `${fileSizeKB}KB`);

    // ── Gemini call ──────────────────────────────────────────────────
    log(`[${requestId}] Step 6/6: Call Gemini API`);
    const base64Data = fileBuffer.toString('base64');
    const base64SizeKB = (base64Data.length / 1024).toFixed(1);
    log(`[${requestId}] Base64 conversion`, `original=${fileSizeKB}KB → base64=${base64SizeKB}KB (+${((base64Data.length / fileBuffer.length) * 100 - 100).toFixed(0)}% overhead)`);

    const apiKeyPresent = !!process.env.GEMINI_API_KEY;
    const apiKeyPreview = process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 8)}...${process.env.GEMINI_API_KEY.slice(-4)}` : 'NOT_SET';
    log(`[${requestId}] Gemini config`, `apiKey="${apiKeyPreview}" | present=${apiKeyPresent} | model="gemini-3.1-flash-lite"`);

    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

    const promptText = buildPrompt({
      tipoDocumento: body.tipoDocumento as string | undefined,
      terceroCount: typeof body.terceroCount === 'number' ? body.terceroCount : undefined,
      proyectoCount: typeof body.proyectoCount === 'number' ? body.proyectoCount : undefined,
    });
    log(`[${requestId}] Prompt`, `"${promptText.split('\n')[0]}..."`);

    let parsed: unknown;
    try {
      log(`[${requestId}] Sending to Gemini...`);
      const startTime = Date.now();
      parsed = await callGeminiWithRetry(client, base64Data, mimeType, promptText);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logSuccess(`[${requestId}] Gemini completed in ${elapsed}s`);
    } catch (error) {
      if (isGoogleApiError(error) && error.status === 429) {
        logError(`[${requestId}] Gemini RATE LIMITED (429 after retry)`);
        return NextResponse.json(
          { error: 'Demasiadas solicitudes. Intentá de nuevo.' },
          { status: 429 },
        );
      }
      // Other Gemini errors → 502
      const geminiMessage = error instanceof Error ? error.message : String(error);
      logError(`[${requestId}] Gemini ERROR`, geminiMessage);
      if (error instanceof Error && error.stack) {
        console.error(`${LOG_PREFIX} [${requestId}] Gemini error stack:`, error.stack);
      }
      return NextResponse.json(
        { error: `Error al procesar el documento con IA: ${geminiMessage}` },
        { status: 502 },
      );
    }

    // ── Success response ─────────────────────────────────────────────
    log(`[${requestId}] Building success response`);
    const data = parsed as {
      proveedorTexto: string | null;
      nit: string | null;
      fechaDocumento: string | null;
      montoTotal: number | null;
      tipoDocumentoSugerido?: string | null;
      descripcion?: string | null;
    };

    const result = {
      proveedorTexto: data.proveedorTexto ?? null,
      nit: data.nit ?? null,
      fechaDocumento: data.fechaDocumento ?? null,
      montoTotal: data.montoTotal ?? null,
      tipoDocumentoSugerido: data.tipoDocumentoSugerido ?? null,
      descripcion: data.descripcion ?? null,
    };

    logSuccess(`[${requestId}] RESPONSE 200`, JSON.stringify(result));
    log(`[${requestId}] === REQUEST COMPLETE ===`);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const requestId = Date.now().toString(36);
    logError(`[${requestId}] UNEXPECTED ERROR`, message);
    if (err instanceof Error && err.stack) {
      console.error(`${LOG_PREFIX} [${requestId}] Stack:`, err.stack);
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
