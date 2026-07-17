import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI } from '@google/genai';
import { getAdminApp, getAdminStorage } from '@/lib/firebase-admin';
import {
  buildPrompt,
  extractFromGemini,
  validateFileForOcr,
  isGoogleApiError,
  MAX_FILE_SIZE,
} from '@/lib/ocr';

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
    const validation = validateFileForOcr(storagePath);
    if (!validation.valid) {
      logError(`[${requestId}] Extension REJECTED`, `"${storagePath.split('.').pop()}" not supported`);
      return NextResponse.json(
        { error: 'Formato no soportado. Usá PDF, PNG o JPG.' },
        { status: 400 },
      );
    }
    const mimeType = validation.mime;
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
      parsed = await extractFromGemini(client, base64Data, mimeType, promptText);
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
