# PDF Preview Specification

> Change: `deuda-tecnica-pdf-transactions` · Date: 2026-07-14

## Purpose

Replace unreliable iframe-based PDF previews with canvas rendering via `react-pdf`, providing consistent cross-browser PDF display without CORS or origin-blocking issues.

## Requirements

### Requirement: PdfViewer — Shared Canvas Component

The system MUST provide a shared `PdfViewer` component that renders PDFs via canvas using `react-pdf`. The component SHALL accept a `pageMode` prop (`"single"` | `"all"`) and SHALL configure the PDF.js worker via the existing `/pdf.worker.min.mjs` path.

#### Scenario: Single page renders one canvas

- GIVEN a PDF file URL and `pageMode="single"`
- WHEN PdfViewer renders
- THEN one canvas displays the first page of the PDF
- AND the canvas scales proportionally to fit the container width

#### Scenario: Paginated mode renders all pages

- GIVEN a PDF file URL and `pageMode="all"`
- WHEN PdfViewer renders
- THEN canvas elements for all pages render vertically
- AND the user scrolls through pages within the container

#### Scenario: Loading state shows spinner

- GIVEN a PDF that is still downloading
- WHEN PdfViewer renders
- THEN a loading indicator matching existing UI patterns is displayed
- AND no canvas renders until the PDF is ready

#### Scenario: Error state shows fallback link

- GIVEN a corrupted PDF or network failure
- WHEN PdfViewer encounters the error
- THEN an error message displays with an "Abrir en nueva pestaña" fallback link to the raw Storage URL

#### Scenario: Empty state shows placeholder

- GIVEN no `fileUrl` prop
- WHEN PdfViewer renders
- THEN a "Sin documento" placeholder is displayed

### Requirement: DocumentoSidepanel — Single-Page Preview

DocumentoSidepanel MUST replace its `<iframe>` with `<PdfViewer pageMode="single" />`, preserving the existing layout, the "Abrir en nueva pestaña" fallback link, and the classification form below.

#### Scenario: Sidepanel previews via canvas

- GIVEN the user clicks a PDF document in the inbox
- WHEN DocumentoSidepanel opens
- THEN the preview area renders a single-page canvas (not iframe)
- AND the fallback link remains visible below the canvas
- AND the classification form below the preview is unaffected

### Requirement: ComprobantesViewer — Paginated Preview

ComprobantesViewer MUST replace its `<iframe>` with `<PdfViewer pageMode="all" />`, preserving existing modal layout, margins, and styling.

#### Scenario: Comprobante PDF shows all pages

- GIVEN the user opens a comprobante PDF
- WHEN ComprobantesViewer renders
- THEN all pages render as stacked canvas elements
- AND modal sizing, close behavior, and margins are unchanged

### Requirement: ExtractoParseModal — Paginated Preview

ExtractoParseModal MUST replace its `<iframe>` with `<PdfViewer pageMode="all" />`, preserving the side-by-side layout (PDF preview on the left, parse form on the right).

#### Scenario: Parse modal shows PDF canvas

- GIVEN the user opens ExtractoParseModal
- WHEN the modal renders
- THEN the PDF renders as stacked canvas pages in the left panel
- AND the parse form remains on the right at its original width
- AND modal proportions are preserved
