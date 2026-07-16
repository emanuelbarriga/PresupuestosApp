import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (hoisted to avoid TDZ with vi.mock) ──────────────────────────

const mockVerifyIdToken = vi.hoisted(() => vi.fn());
const mockDownload = vi.hoisted(() => vi.fn());
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  getAdminApp: vi.fn(() => ({})),
  getAdminStorage: vi.fn(() => ({
    bucket: () => ({
      file: () => ({
        exists: vi.fn().mockResolvedValue([true]),
        download: mockDownload,
      }),
    }),
  })),
}));

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
  }
  return { GoogleGenAI: MockGoogleGenAI };
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function postRequest(body: unknown, token?: string) {
  // Dynamic import so mocks are active
  const { POST } = await import('../route');
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const req = new NextRequest('http://localhost/api/ocr/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/ocr/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: valid auth + valid file + successful Gemini response
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'test@test.com' });
    mockDownload.mockResolvedValue([Buffer.from('fake pdf content')]);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        proveedorTexto: 'Proveedor S.A.S.',
        nit: '900123456-7',
        fechaDocumento: '2026-07-15',
        montoTotal: 1500000,
        tipoDocumentoSugerido: 'factura_venta',
      }),
      candidates: [],
    });
  });

  // ── 401: No token ─────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is present', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/ocr/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'some/path.pdf' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('No autorizado');
  });

  // ── 401: Invalid token ────────────────────────────────────────────────

  it('returns 401 when token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    const res = await postRequest({ storagePath: 'some/path.pdf' }, 'bad-token');
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('No autorizado');
  });

  // ── 401: Token in body (only header valid) ────────────────────────────

  it('returns 401 when auth token is in body instead of header', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/ocr/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: 'some/path.pdf', authToken: 'abc123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('No autorizado');
  });

  // ── 400: Missing storagePath ──────────────────────────────────────────

  it('returns 400 when storagePath is missing', async () => {
    const res = await postRequest({}, 'valid-token');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('storagePath requerido');
  });

  // ── 400: Unsupported extension (.docx) ────────────────────────────────

  it('returns 400 for unsupported file extension (.docx)', async () => {
    const res = await postRequest({ storagePath: 'doc.docx' }, 'valid-token');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Formato no soportado. Usá PDF, PNG o JPG.');
  });

  // ── 400: NOT for uppercase extension (.PDF) ───────────────────────────

  it('accepts uppercase extension FACTURA.PDF (case insensitive)', async () => {
    const res = await postRequest({ storagePath: 'FACTURA.PDF' }, 'valid-token');
    // Should NOT be 400 — case-insensitive matching
    expect(res.status).not.toBe(400);
  });

  // ── 413: File exceeds 5MB ─────────────────────────────────────────────

  it('returns 413 when file exceeds 5MB', async () => {
    // Buffer larger than 5,242,880 bytes
    mockDownload.mockResolvedValue([Buffer.alloc(6_000_000)]);
    const res = await postRequest({ storagePath: 'large.pdf' }, 'valid-token');
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toBe('El archivo excede el límite de 5MB');
  });

  // ── 429 retry: first 429 → second 200 OK ──────────────────────────────

  it('retries once on 429 and succeeds on second attempt', async () => {
    const gemini429 = new Error('Rate limited');
    (gemini429 as any).status = 429;
    const retrySuccess = Object.defineProperty({ candidates: [] }, 'text', {
      get: () => JSON.stringify({
        proveedorTexto: 'Proveedor S.A.S.',
        nit: '900123456-7',
        fechaDocumento: '2026-07-15',
        montoTotal: 1500000,
      }),
    });
    mockGenerateContent
      .mockRejectedValueOnce(gemini429)
      .mockResolvedValueOnce(retrySuccess);

    const res = await postRequest({ storagePath: 'doc.pdf' }, 'valid-token');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.proveedorTexto).toBe('Proveedor S.A.S.');
    // Should have called generateContent twice
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // ── 429 both fail ─────────────────────────────────────────────────────

  it('returns 429 when both Gemini attempts are rate limited', async () => {
    const gemini429 = new Error('Rate limited');
    (gemini429 as any).status = 429;
    mockGenerateContent
      .mockRejectedValueOnce(gemini429)
      .mockRejectedValueOnce(gemini429);

    const res = await postRequest({ storagePath: 'doc.pdf' }, 'valid-token');
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe('Demasiadas solicitudes. Intentá de nuevo.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // ── 502: Non-recoverable Gemini error ─────────────────────────────────

  it('returns 502 on non-recoverable Gemini error', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini internal error'));
    const res = await postRequest({ storagePath: 'doc.pdf' }, 'valid-token');
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain('Error al procesar el documento con IA');
  });

  // ── 200: Full fields ──────────────────────────────────────────────────

  it('returns 200 with all fields populated for a valid request', async () => {
    const res = await postRequest({ storagePath: 'factura.pdf' }, 'valid-token');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      proveedorTexto: 'Proveedor S.A.S.',
      nit: '900123456-7',
      fechaDocumento: '2026-07-15',
      montoTotal: 1500000,
      tipoDocumentoSugerido: 'factura_venta',
      descripcion: null,
    });
  });

  // ── 200: Partial nulls ────────────────────────────────────────────────

  it('returns 200 with partial null fields when Gemini returns partial data', async () => {
    const partialResponse = Object.defineProperty({ candidates: [] }, 'text', {
      get: () => JSON.stringify({
        proveedorTexto: null,
        nit: '900123456-7',
        fechaDocumento: null,
        montoTotal: null,
      }),
    });
    mockGenerateContent.mockResolvedValue(partialResponse);

    const res = await postRequest({ storagePath: 'partial.pdf' }, 'valid-token');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      proveedorTexto: null,
      nit: '900123456-7',
      fechaDocumento: null,
      montoTotal: null,
      tipoDocumentoSugerido: null,
      descripcion: null,
    });
  });
});
