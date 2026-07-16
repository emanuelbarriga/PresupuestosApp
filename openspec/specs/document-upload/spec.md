# Document Upload Specification

> Capability: `document-upload` · Date: 2026-07-14

## Purpose

Bulk-upload documents via dropzone, persist metadata in `/documentos` collection with flat Storage paths, and surface unclassified documents (`status == "por_clasificar"`) in an inbox grid.

## Requirements

### Requirement: Dropzone Bulk Upload

The system MUST provide a dropzone component accepting multiple files (PDF, JPG, PNG, WEBP) with per-file progress bars.

#### Scenario: Single valid file upload

- GIVEN the user drops a valid PDF
- WHEN the upload completes
- THEN a `DocumentoMedio` record is created with `status: "por_clasificar"`
- AND the Storage path is `companies/{cId}/documentos/{uuid}-{fileName}`

#### Scenario: Mixed valid and invalid files

- GIVEN the user drops 3 files: PDF, JPG, and `script.exe`
- WHEN the upload processes
- THEN the PDF and JPG create `DocumentoMedio` records
- AND the EXE shows an error toast
- AND no DocumentoMedio record exists for the EXE

### Requirement: Upload Progress and Error

The system SHALL show per-file upload progress (%) and display toast notifications on completion or failure.

| State | UI Feedback | Side Effect |
|-------|-------------|-------------|
| Uploading | Progress bar per file (0–100%) | None |
| Success | Green toast: "documento.pdf subido" | DocumentoMedio created |
| Failure | Red toast: "Error al subir {filename}" | No Firestore write |

#### Scenario: Network failure mid-upload

- GIVEN a 3MB file is uploading and network drops
- WHEN the upload task rejects
- THEN an error toast appears with the file name
- AND no DocumentoMedio record is created

### Requirement: Inbox Grid

The system MUST display a grid of documents filtered by `status == "por_clasificar"`, showing file name, type icon, size, and upload date.

#### Scenario: Inbox displays unclassified only

- GIVEN 10 DocumentoMedio records (6 `por_clasificar`, 4 `enlazado`)
- WHEN the inbox loads
- THEN it displays 6 documents
- AND each shows file name, size, type icon, and relative date

#### Scenario: Empty inbox

- GIVEN no documents with `status == "por_clasificar"`
- WHEN the inbox loads
- THEN it shows an empty state: "No hay documentos sin clasificar"

### Requirement: Document Click Navigation

Clicking a document in the inbox SHALL open `DocumentoSidepanel` for classification (defined in `document-classification` spec).

#### Scenario: Click opens sidepanel

- GIVEN a `por_clasificar` document in the inbox
- WHEN the user clicks it
- THEN DocumentoSidepanel opens with the document loaded for editing
