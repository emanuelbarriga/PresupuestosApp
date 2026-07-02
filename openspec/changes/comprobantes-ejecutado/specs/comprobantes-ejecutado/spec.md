# Comprobantes de Ejecutado

## Purpose

Attach proof documents (receipts, invoices, PDFs) to ejecuciones for audit and reconciliation. Upload, store, and display comprobantes from the ejecucion form and detail view.

## Requirements

### Requirement: Storage Initialization

The system MUST export a `storage` instance from `lib/firebase.ts` via `getStorage(app)`.

#### Scenario: Storage exported from firebase.ts

- GIVEN the Firebase app is initialized
- WHEN `lib/firebase.ts` is imported
- THEN `storage` is available as a named export

### Requirement: Comprobante Type

The system MUST define `Comprobante { id: string; name: string; url: string; type: string; size: number; uploadedAt: string }` and add `comprobantes: Comprobante[]` to the `Ejecucion` interface.

#### Scenario: Ejecucion carries comprobantes array

- GIVEN an `Ejecucion` document in Firestore
- WHEN the document is deserialized
- THEN the `comprobantes` field is an array of `Comprobante` objects (defaults to `[]`)

### Requirement: Upload on File Selection

The system SHOULD upload the file immediately when selected, not on form submit. MUST accept only PDF, JPG, and PNG. MUST reject files over 5MB. MUST display upload progress.

#### Scenario: Happy path — upload PDF

- GIVEN the user is on the ejecucion form
- WHEN they select a 2MB PDF file
- THEN the file uploads to `{companyId}/ejecuciones/{ejecucionId}/{uuid}-{name}`
- AND a `Comprobante` record is appended to the ejecucion's `comprobantes` array
- AND the Firestore document is updated

#### Scenario: Upload progress visible

- GIVEN the user selects a file
- WHEN the upload is in progress
- THEN a progress indicator (percentage or spinner) is shown

#### Scenario: Reject oversized file

- GIVEN the user selects a 6MB file
- WHEN validation runs
- THEN the file is rejected with an error message "File must be under 5MB"
- AND no upload occurs

#### Scenario: Reject unsupported type

- GIVEN the user selects a `.gif` file
- WHEN validation runs
- THEN the file is rejected with an error message "Only PDF, JPG, and PNG files are supported"
- AND no upload occurs

### Requirement: Display Comprobantes in Detail View

The system MUST render a file list in the ejecucion detail view (`EjecucionView`). MUST provide a download link for each file. SHOULD show a thumbnail preview for image files (JPG, PNG).

#### Scenario: Comprobante list shown in EjecucionView

- GIVEN an ejecucion with 2 comprobantes
- WHEN the user opens the ejecucion detail view
- THEN both comprobantes are listed with name, type, and size
- AND each has a download link

#### Scenario: Image thumbnail displayed

- GIVEN an ejecucion with a JPG comprobante
- WHEN the detail view renders
- THEN a thumbnail preview of the image is shown

### Requirement: Storage Security Rules

The system MUST define `storage.rules` that allow writes only to authenticated users, allow reads from any authenticated user, validate content-type (image/jpeg, image/png, application/pdf), validate path pattern `/{companyId}/ejecuciones/{ejecucionId}/{fileName}`, and reject files over 5MB.

#### Scenario: Unauthenticated read rejected

- GIVEN a user is not authenticated
- WHEN they attempt to download a comprobante
- THEN the storage rule denies access
- AND the download fails

### Requirement: CORS Configuration

The Storage bucket SHOULD have CORS configured. The gsutil command `gsutil cors set cors.json gs://planningsaman-3cf7e.firebasestorage.app` MUST be documented in the project setup notes.

### Requirement: Orphan File Documentation

The spec SHOULD acknowledge that files uploaded but tied to a cancelled form submission become orphan objects in the bucket without automatic cleanup in the first iteration.

#### Scenario: Orphan file on form cancel

- GIVEN the user uploads a file
- WHEN they close the form without saving
- THEN the file remains in Storage (orphan)
- AND this is an accepted risk documented in the spec
