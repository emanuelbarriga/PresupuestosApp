# Delta for ocr-extraction

> Change: `batch-ocr` · Capability: `ocr-extraction` · Created: 2026-07-16

## No API Surface Changes

The `ocr-extraction` capability requires **no endpoint changes**. Batch OCR uses the client-orchestrated approach: the browser sends individual per-doc requests to the existing `POST /api/ocr/extract` endpoint, with a concurrency cap of 3 parallel requests.

### Rationale

Server-side batch processing (`POST /api/ocr/batch-extract`) would introduce:
- **Serverless timeout risk**: Firebase App Hosting has a 60s request limit. Processing 10+ Gemini calls sequentially would exceed this.
- **Per-doc progress complexity**: Without SSE/WebSocket, the client cannot get per-doc status during a single batch request.
- **Code duplication**: The extraction pipeline already works per-doc. Batching at the client level reuses it perfectly.

The existing 429 retry logic (1s backoff + 1 retry) and all validation in `route.ts` remain unchanged.

### Added Scope for This Change

- Refactor `route.ts` to extract shared Gemini logic into `lib/ocr.ts` (pure refactor, no behavior change).
- The route becomes a thin handler: auth → validate → call `extractFromGemini()` → respond.
