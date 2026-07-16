# Design V2: OCR/Gemini Integration (Revised)

> Correcciones de V1: auth solo en header (no body), single `download()` sin `getMetadata`, `responseJsonSchema` en vez de `responseSchema`, pre-fill no-destructivo (solo campos vacíos), OcrState como máquina de estados.

## Technical Approach

Server-side OCR via Gemini 2.5 Flash (`@google/genai` + `responseJsonSchema`). `POST /api/ocr/extract` → `download()` desde Firebase Storage → valida size/extensión → bytes a Base64 → Gemini structured output → pre-fill no-destructivo en DocumentoSidepanel. Sin Firestore writes desde la API, sin schema changes.

## Architecture Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Gemini SDK | `@google/genai` vs raw REST | `@google/genai` | `responseJsonSchema` built-in, tipado, manejo de errores nativo |
| Output mode | `responseJsonSchema` vs `response_mime_type` | `responseJsonSchema` | Schema-enforced, evita parseo de free-form JSON, no experimental (confirmado en SDK latest) |
| File fetch | `download()` vs `getMetadata()` + `download()` | `download()` solo | Elimina ~200ms roundtrip del `getMetadata` — buffer.length es suficiente para validar size |
| Auth token | Header vs body | `Authorization: Bearer` header | Consistente con 4 routes existentes, evita mezcla header/body |
| Pre-fill strategy | Always fill vs solo vacíos | Solo campos vacíos | No-destructivo — respeta entrada manual del usuario |
| Timeout | 30s vs 60s | 30s | Next.js serverless default; Gemini 2.5 Flash typical 2-5s, 30s cubre outliers |
| Retry 429 | 1 retry 1s vs exponential backoff | 1 retry 1s | 60 docs/mes ~2 calls/día — backoff complejo innecesario |

## Data Flow

```
DocumentoSidepanel              POST /api/ocr/extract          Firebase Storage     Gemini 2.5 Flash
      │                                 │                            │                    │
      │  { Authorization,               │                            │                    │
      │    storagePath }                 │                            │                    │
      ├────────────────────────────────►│                            │                    │
      │                                 │──verifyIdToken(token)─────►│                    │
      │                                 │◀──uid───────────────────── │                    │
      │                                 │                            │                    │
      │                                 │──bucket.file(path)────────►│                    │
      │                                 │   .download()              │                    │
      │                                 │◀──Buffer───────────────────│                    │
      │                                 │                            │                    │
      │                                 │──validate: buffer.length   │                    │
      │                                 │  >5MB → 413               │                    │
      │                                 │──validate: extension via    │                    │
│                                 │  path.extname().toLowerCase│                    │
│                                 │  unsupported → 400         │                    │
      │                                 │                            │                    │
      │                                 │──buffer.toString('base64') │                    │
      │                                 │──generateContent(          │                    │
      │                                 │    base64 + mimeType +     │                    │
      │                                 │    responseJsonSchema)─────►                    │
      │                                 │◀──{ proveedorTexto,        │                    │
      │                                 │     nit, fechaDocumento,   │                    │
      │                                 │     montoTotal }◄──────────                    │
      │                                 │                            │                    │
      │◀──200 { proveedorTexto, ... }───│                            │                    │
      │                                 │                            │                    │
      │──pre-fill ONLY empty fields────►│                            │                    │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@google/genai` |
| `.env` / `.env.example` | Modify | Add `GEMINI_API_KEY` |
| `lib/firebase-admin.ts` | Modify | Export `getAdminStorage()` desde `firebase-admin/storage` |
| `app/api/ocr/extract/route.ts` | **Create** | POST handler con auth, file fetch, Gemini call, retry, errores mapeados |
| `components/entities/documento/DocumentoSidepanel.tsx` | Modify | Reemplazar OCR stub con botón + estados loading/error + pre-fill |

## Interfaces / Contracts

### API: `POST /api/ocr/extract`

```typescript
// Request
interface OcrExtractRequest {
  storagePath: string; // "c1/documentos/uuid-factura.pdf"
}

// Success 200
interface OcrExtractResponse {
  proveedorTexto: string | null;
  nit: string | null;
  fechaDocumento: string | null;  // YYYY-MM-DD
  montoTotal: number | null;
}

// Error (4xx/5xx)
interface OcrErrorResponse {
  error: string;
}
```

### Client State Machine

```typescript
type OcrState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: OcrExtractResponse }
  | { status: 'error'; message: string; code?: string };

// Transition: cualquier estado → loading limpia el estado anterior
// Si el estado era 'error' y el usuario vuelve a hacer clic,
// setOcrState({ status: 'loading' }) reemplaza el banner de error
// por el spinner nuevo. No se acumulan errores viejos.
```

> **State clearing on retry**: Cuando el usuario hace clic en "Extraer con IA" desde cualquier estado (idle o error), la transición a `{ status: 'loading' }` SOBRESCRIBE el estado anterior. El banner de error viejo desaparece inmediatamente y se reemplaza por el spinner. No es necesario limpiar manualmente — la asignación del nuevo objeto en React setter reemplaza el estado anterior por completo.

### Gemini Schema

```typescript
const OCR_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    proveedorTexto: { type: 'string', nullable: true },
    nit:            { type: 'string', nullable: true },
    fechaDocumento: { type: 'string', nullable: true },
    montoTotal:     { type: 'number', nullable: true },
  },
  required: ['proveedorTexto', 'nit', 'fechaDocumento', 'montoTotal'],
};
```

## Key Code Patterns

### Pre-fill no-destructivo (solo campos vacíos)

> **TypeScript note**: El formulario usa `string` para todos los campos (inicializados con `?? ''`). `ocrData.nit`/`proveedorTexto`/`fechaDocumento` son `string | null`. `ocrData.montoTotal` es `number | null` → debe convertirse a `string` mediante `.toString()` para el setter del formulario. La condición `!nit` cubre tanto `''` como `null` de forma segura.

```typescript
// Solo llena campos VACÍOS — no destructivo
if (!nit && ocrData.nit) setNit(ocrData.nit)
if (!proveedorTexto && ocrData.proveedorTexto) setProveedorTexto(ocrData.proveedorTexto)
if (!fechaDocumento && ocrData.fechaDocumento) setFechaDocumento(ocrData.fechaDocumento)
if (montoTotal === '' && ocrData.montoTotal !== null) setMontoTotal(ocrData.montoTotal.toString())
```

### Retry 429 (1 intento, 1s delay)

```typescript
async function callGeminiWithRetry(client: GoogleGenAI, content: unknown): Promise<GenAiResponse> {
  try {
    return await client.models.generateContent({ model: 'gemini-2.5-flash', ...content, config: { responseJsonSchema: OCR_JSON_SCHEMA } });
  } catch (error) {
    if (isGoogleApiError(error) && error.code === 429) {
      await sleep(1000);
      return await client.models.generateContent({ model: 'gemini-2.5-flash', ...content, config: { responseJsonSchema: OCR_JSON_SCHEMA } });
    }
    throw error;
  }
}
```

### getAdminStorage

```typescript
import { getStorage } from 'firebase-admin/storage';
export function getAdminStorage() { return getStorage(getAdminApp()); }
```

## Error Response Table

| Condition | HTTP | `{ error }` |
|-----------|------|-------------|
| No `Authorization` header | 401 | `"No autorizado"` |
| Invalid/expired token | 401 | `"No autorizado"` |
| Missing `storagePath` | 400 | `"storagePath requerido"` |
| Extensión no soportada (≠ .pdf/.png/.jpg/.jpeg) | 400 | `"Formato no soportado. Usá PDF, PNG o JPG."` |
| File >5MB | 413 | `"El archivo excede el límite de 5MB"` |
| File not found in Storage | 404 | `"Archivo no encontrado"` |
| Gemini rate-limited (tras retry fallido) | 429 | `"Demasiadas solicitudes. Intentá de nuevo."` |
| Gemini error | 502 | `"Error al procesar el documento con IA"` |
| Timeout (>30s) | 504 | `"El servicio tardó demasiado. Intentá de nuevo."` |
| Internal error | 500 | `"Error interno del servidor"` |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (route) | Auth validation, file size guard, format guard, Gemini success/error, retry | `vi.mock('firebase-admin/auth')`, `vi.mock('firebase-admin/storage')`, `vi.mock('@google/genai')` |
| Unit (component) | Botón Extraer con IA, loading/error/success states, pre-fill solo vacíos | `vi.mock('firebase/auth')` para `getIdToken()`, mock `fetch` en `render()` — extender test existente |
| Integration | Full round-trip con mocks externos | Route handler test verificando response shape |

## Open Questions

- [ ] Confirmar que `responseJsonSchema` es el nombre exacto del parámetro en `@google/genai` latest — puede ser `responseSchema` según versión. Pin version after install.
- [x] ~~Multi-page PDFs: antes se asumía que Gemini procesaba solo página 1 por limitación de Vercel 10s. Como no estamos en Vercel Hobby, **Gemini 2.5 Flash procesa PDFs multi-página completos** (soporta hasta 1M tokens). No hay restricción artificial. El límite real es el timeout de 30s, que da margen de sobra para facturas de 2-5 páginas.
