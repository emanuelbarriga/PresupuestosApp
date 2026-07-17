import { GoogleGenAI } from '@google/genai';
import path from 'path';

// ─── Constants ───────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 5_242_880; // 5 MB
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
export const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export const OCR_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    proveedorTexto: { type: 'string', nullable: true },
    nit: { type: 'string', nullable: true },
    fechaDocumento: { type: 'string', nullable: true },
    montoTotal: { type: 'number', nullable: true },
    tipoDocumentoSugerido: {
      type: 'string',
      nullable: true,
      description:
        'Tipo de documento: factura_venta, factura_compra, extracto_bancario, comprobante_egreso, comprobante_ingreso, planilla, contrato, otro',
    },
    descripcion: {
      type: 'string',
      nullable: true,
      description:
        'Descripción del documento o texto relevante extraído (ej. concepto, notas, referencias)',
    },
  },
  required: ['proveedorTexto', 'nit', 'fechaDocumento', 'montoTotal'],
};

// ─── Types ────────────────────────────────────────────────────────────────

export interface OcrExtractResponse {
  proveedorTexto: string | null;
  nit: string | null;
  fechaDocumento: string | null;
  montoTotal: number | null;
  tipoDocumentoSugerido: string | null;
  descripcion: string | null;
}

// ─── Prompt Builder ──────────────────────────────────────────────────────

export function buildPrompt(context?: {
  tipoDocumento?: string;
  terceroCount?: number;
  proyectoCount?: number;
}): string {
  const tipo = context?.tipoDocumento
    ? `${context.tipoDocumento} colombiano`
    : 'factura o comprobante colombiano';

  const stats: string[] = [];
  if (context?.terceroCount && context.terceroCount > 0) {
    stats.push(`${context.terceroCount} proveedores registrados`);
  }
  if (context?.proyectoCount && context.proyectoCount > 0) {
    stats.push(`${context.proyectoCount} proyectos activos`);
  }

  const statsLine =
    stats.length > 0
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

// ─── Helpers ─────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isGoogleApiError(
  err: unknown,
): err is Error & { status?: number } {
  return err instanceof Error && 'status' in err;
}

export function getMimeFromExtension(storagePath: string): string | null {
  const ext = path.extname(storagePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;
  return EXTENSION_MIME_MAP[ext];
}

export function validateFileForOcr(
  storagePath: string,
): { valid: true; mime: string } | { valid: false } {
  const mime = getMimeFromExtension(storagePath);
  if (!mime) return { valid: false };
  return { valid: true, mime };
}

// ─── Gemini caller with retry ────────────────────────────────────────────

export async function extractFromGemini(
  client: GoogleGenAI,
  base64Data: string,
  mimeType: string,
  promptText: string,
): Promise<unknown> {
  const content = [
    { text: promptText },
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
  ];

  const makeCall = (attempt: number) =>
    client.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: content,
      config: { responseJsonSchema: OCR_JSON_SCHEMA },
    });

  try {
    const result = await makeCall(1);
    const text = result.text;
    if (!text) throw new Error('Empty response from Gemini');
    return JSON.parse(text);
  } catch (error) {
    if (isGoogleApiError(error) && error.status === 429) {
      await sleep(1000);
      try {
        const result = await makeCall(2);
        const retryText = result.text;
        if (!retryText) throw new Error('Empty response from Gemini on retry');
        return JSON.parse(retryText);
      } catch (retryError) {
        if (isGoogleApiError(retryError) && retryError.status === 429) {
          throw retryError;
        }
        throw retryError;
      }
    }
    throw error;
  }
}

// ─── Error Message Mapping ──────────────────────────────────────────────

const ERROR_MESSAGE_MAP: Array<{
  match: RegExp | number;
  message: string;
}> = [
  { match: /Formato no soportado/, message: 'Formato no soportado. Usá PDF, PNG o JPG.' },
  { match: /El archivo excede el límite de 5MB/, message: 'El archivo es muy pesado (máx 5MB)' },
  { match: /timeout|timed out/i, message: 'Tiempo de espera agotado. El documento es muy grande o complejo.' },
  { match: /network|econnrefused|econnreset/i, message: 'Error de conexión. Verificá tu internet y reintentá.' },
  { match: /gemini/i, message: 'No se pudo leer el documento. Puede estar borroso o ilegible.' },
];

const STATUS_MESSAGE_MAP: Record<number, string> = {
  429: 'Demasiadas solicitudes. Esperá unos segundos y reintentá.',
  502: 'No se pudo leer el documento. Puede estar borroso o ilegible.',
};

const FALLBACK_MESSAGE = 'Error al procesar el documento. Reintentá más tarde.';

export function getFriendlyErrorMessage(
  errorBody?: string,
  status?: number,
): string {
  // 1. Check status-based mapping first (these take precedence)
  if (status && STATUS_MESSAGE_MAP[status]) {
    return STATUS_MESSAGE_MAP[status];
  }

  // 2. Check error body text patterns
  if (errorBody) {
    for (const entry of ERROR_MESSAGE_MAP) {
      if (entry.match instanceof RegExp && entry.match.test(errorBody)) {
        return entry.message;
      }
    }
  }

  // 3. Fallback
  return FALLBACK_MESSAGE;
}
