import { describe, it, expect } from 'vitest';

// ─── Imports (will initially fail — production code doesn't exist yet) ─────────

import {
  buildPrompt,
  validateFileForOcr,
  getFriendlyErrorMessage,
  ALLOWED_EXTENSIONS,
  EXTENSION_MIME_MAP,
  MAX_FILE_SIZE,
  OCR_JSON_SCHEMA,
} from '@/lib/ocr';

// ═══════════════════════════════════════════════════════════════════════════════
// buildPrompt
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildPrompt', () => {
  it('returns default prompt when no context is given', () => {
    const result = buildPrompt();
    expect(result).toContain('factura o comprobante colombiano');
    expect(result).toContain('- proveedorTexto');
    expect(result).toContain('- nit');
    expect(result).toContain('- fechaDocumento');
    expect(result).toContain('- montoTotal');
    expect(result).toContain('- tipoDocumentoSugerido');
    expect(result).toContain('- descripcion');
  });

  it('includes tipoDocumento in the prompt when provided', () => {
    const result = buildPrompt({ tipoDocumento: 'factura_compra' });
    expect(result).toContain('factura_compra colombiano');
    expect(result).not.toContain('factura o comprobante colombiano');
  });

  it('includes stats line when terceroCount > 0', () => {
    const result = buildPrompt({ terceroCount: 5 });
    expect(result).toContain('5 proveedores registrados');
    expect(result).toContain('El sistema tiene');
  });

  it('includes stats line when proyectoCount > 0', () => {
    const result = buildPrompt({ proyectoCount: 3 });
    expect(result).toContain('3 proyectos activos');
    expect(result).toContain('El sistema tiene');
  });

  it('includes both tercero and proyecto stats when both provided', () => {
    const result = buildPrompt({ terceroCount: 5, proyectoCount: 3 });
    expect(result).toContain('5 proveedores registrados');
    expect(result).toContain('3 proyectos activos');
    expect(result).toContain('El sistema tiene');
  });

  it('omits stats line when both counts are 0', () => {
    const result = buildPrompt({ terceroCount: 0, proyectoCount: 0 });
    expect(result).not.toContain('El sistema tiene');
  });

  it('omits stats line when counts are undefined', () => {
    const result = buildPrompt({});
    expect(result).not.toContain('El sistema tiene');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateFileForOcr
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateFileForOcr', () => {
  it('returns valid=true with mime for .pdf', () => {
    const result = validateFileForOcr('documento.pdf');
    expect(result).toEqual({ valid: true, mime: 'application/pdf' });
  });

  it('returns valid=true with mime for .png', () => {
    const result = validateFileForOcr('imagen.png');
    expect(result).toEqual({ valid: true, mime: 'image/png' });
  });

  it('returns valid=true with mime for .jpg', () => {
    const result = validateFileForOcr('foto.jpg');
    expect(result).toEqual({ valid: true, mime: 'image/jpeg' });
  });

  it('returns valid=true with mime for .jpeg', () => {
    const result = validateFileForOcr('scan.jpeg');
    expect(result).toEqual({ valid: true, mime: 'image/jpeg' });
  });

  it('returns valid=false for unsupported .heic extension', () => {
    const result = validateFileForOcr('image.heic');
    expect(result).toEqual({ valid: false });
  });

  it('returns valid=false for unsupported .docx extension', () => {
    const result = validateFileForOcr('document.docx');
    expect(result).toEqual({ valid: false });
  });

  it('returns valid=true for uppercase .PNG (case insensitive)', () => {
    const result = validateFileForOcr('IMAGEN.PNG');
    expect(result).toEqual({ valid: true, mime: 'image/png' });
  });

  it('returns valid=true for uppercase .PDF (case insensitive)', () => {
    const result = validateFileForOcr('FACTURA.PDF');
    expect(result).toEqual({ valid: true, mime: 'application/pdf' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getFriendlyErrorMessage
// ═══════════════════════════════════════════════════════════════════════════════

describe('getFriendlyErrorMessage', () => {
  it('returns format message for "Formato no soportado" error', () => {
    const msg = getFriendlyErrorMessage('Formato no soportado');
    expect(msg).toBe('Formato no soportado. Usá PDF, PNG o JPG.');
  });

  it('returns size message for "El archivo excede el límite de 5MB" error', () => {
    const msg = getFriendlyErrorMessage('El archivo excede el límite de 5MB');
    expect(msg).toBe('El archivo es muy pesado (máx 5MB)');
  });

  it('returns retry message for HTTP 429', () => {
    const msg = getFriendlyErrorMessage(undefined, 429);
    expect(msg).toBe('Demasiadas solicitudes. Esperá unos segundos y reintentá.');
  });

  it('returns unreadable document message for HTTP 502', () => {
    const msg = getFriendlyErrorMessage(undefined, 502);
    expect(msg).toBe('No se pudo leer el documento. Puede estar borroso o ilegible.');
  });

  it('returns timeout message when errorBody contains "timeout" or "timed out"', () => {
    const msg = getFriendlyErrorMessage('timeout');
    expect(msg).toBe('Tiempo de espera agotado. El documento es muy grande o complejo.');
  });

  it('returns timeout message when errorBody contains "timed out"', () => {
    const msg = getFriendlyErrorMessage('connection timed out');
    expect(msg).toBe('Tiempo de espera agotado. El documento es muy grande o complejo.');
  });

  it('returns network error message when errorBody contains "network" or "ECONNREFUSED"', () => {
    const msg = getFriendlyErrorMessage('network error');
    expect(msg).toBe('Error de conexión. Verificá tu internet y reintentá.');
  });

  it('returns network error message for ECONNREFUSED', () => {
    const msg = getFriendlyErrorMessage('ECONNREFUSED');
    expect(msg).toBe('Error de conexión. Verificá tu internet y reintentá.');
  });

  it('returns Gemini/unreadable message when errorBody contains "Gemini"', () => {
    const msg = getFriendlyErrorMessage('Gemini internal error');
    expect(msg).toBe('No se pudo leer el documento. Puede estar borroso o ilegible.');
  });

  it('returns fallback for unknown error body with no status', () => {
    const msg = getFriendlyErrorMessage('Algo salió mal');
    expect(msg).toBe('Error al procesar el documento. Reintentá más tarde.');
  });

  it('returns fallback for undefined error and no status', () => {
    const msg = getFriendlyErrorMessage();
    expect(msg).toBe('Error al procesar el documento. Reintentá más tarde.');
  });

  it('returns Gemini message for HTTP 502 with error body "Gemini"', () => {
    // 502 specific message takes precedence over Gemini detection
    const msg = getFriendlyErrorMessage('Gemini API error', 502);
    expect(msg).toBe('No se pudo leer el documento. Puede estar borroso o ilegible.');
  });

  it('returns retry message for 429 even with an error body', () => {
    const msg = getFriendlyErrorMessage('Gemini error', 429);
    expect(msg).toBe('Demasiadas solicitudes. Esperá unos segundos y reintentá.');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

describe('constants', () => {
  it('MAX_FILE_SIZE is 5MB (5242880)', () => {
    expect(MAX_FILE_SIZE).toBe(5_242_880);
  });

  it('ALLOWED_EXTENSIONS contains .pdf, .png, .jpg, .jpeg', () => {
    expect(ALLOWED_EXTENSIONS.has('.pdf')).toBe(true);
    expect(ALLOWED_EXTENSIONS.has('.png')).toBe(true);
    expect(ALLOWED_EXTENSIONS.has('.jpg')).toBe(true);
    expect(ALLOWED_EXTENSIONS.has('.jpeg')).toBe(true);
  });

  it('ALLOWED_EXTENSIONS does not contain .heic', () => {
    expect(ALLOWED_EXTENSIONS.has('.heic')).toBe(false);
  });

  it('EXTENSION_MIME_MAP maps correctly', () => {
    expect(EXTENSION_MIME_MAP['.pdf']).toBe('application/pdf');
    expect(EXTENSION_MIME_MAP['.png']).toBe('image/png');
    expect(EXTENSION_MIME_MAP['.jpg']).toBe('image/jpeg');
    expect(EXTENSION_MIME_MAP['.jpeg']).toBe('image/jpeg');
  });

  it('OCR_JSON_SCHEMA has the correct structure', () => {
    expect(OCR_JSON_SCHEMA).toHaveProperty('type', 'object');
    expect(OCR_JSON_SCHEMA.properties).toHaveProperty('proveedorTexto');
    expect(OCR_JSON_SCHEMA.properties).toHaveProperty('nit');
    expect(OCR_JSON_SCHEMA.properties).toHaveProperty('fechaDocumento');
    expect(OCR_JSON_SCHEMA.properties).toHaveProperty('montoTotal');
    expect(OCR_JSON_SCHEMA.properties).toHaveProperty('tipoDocumentoSugerido');
    expect(OCR_JSON_SCHEMA.properties).toHaveProperty('descripcion');
    expect(OCR_JSON_SCHEMA.required).toContain('proveedorTexto');
    expect(OCR_JSON_SCHEMA.required).toContain('nit');
    expect(OCR_JSON_SCHEMA.required).toContain('fechaDocumento');
    expect(OCR_JSON_SCHEMA.required).toContain('montoTotal');
  });
});
