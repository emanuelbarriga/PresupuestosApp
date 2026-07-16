# Storage Security Rules — Documentos Path

> Change: `sistema-medios-desacoplado` · Domain: `storage-rules` · Date: 2026-07-14

## Purpose

Add Firebase Storage security rules for the `companies/{companyId}/documentos/{fileName}` path, scoping access by company membership and file type.

## Requirements

### Requirement: Multi-tenant Storage Isolation

Storage read/write SHALL be scoped to `companies/{companyId}/documentos/` using the existing `isMember(companyId)` helper.

#### Scenario: Member reads a document file

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to read `companies/abc/documentos/uuid-report.pdf`
- THEN the read is allowed

#### Scenario: Non-member tries to read

- GIVEN a user who is NOT a member of company `abc`
- WHEN they attempt to read `companies/abc/documentos/uuid-report.pdf`
- THEN the read is denied

### Requirement: File Type Restriction on Upload

Uploads to `companies/{companyId}/documentos/` SHALL be restricted to allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. File size SHALL NOT exceed 10MB.

| Constraint | Value |
|-----------|-------|
| Allowed MIME types | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |
| Max file size | 10 MB |

#### Scenario: PDF upload allowed

- GIVEN a valid company member
- WHEN they upload a 2MB PDF to `companies/abc/documentos/invoice.pdf`
- THEN the write is allowed

#### Scenario: Oversized file rejected

- GIVEN a valid company member
- WHEN they upload a 15MB file to `companies/abc/documentos/`
- THEN the write is denied

#### Scenario: Wrong MIME type rejected

- GIVEN a valid company member
- WHEN they upload `script.exe` to `companies/abc/documentos/`
- THEN the write is denied

### Requirement: No Deletes from Client

Client-side deletes from Storage `companies/{companyId}/documentos/` SHALL be denied. Physical cleanup is managed by server-side GC scripts.

#### Scenario: Client delete denied

- GIVEN a file at `companies/abc/documentos/uuid-report.pdf`
- WHEN the client attempts to delete it
- THEN the delete is denied
