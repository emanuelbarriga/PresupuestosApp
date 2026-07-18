# Storage Security Rules — Membership Isolation

> Change: `storage-rules-company-security` · Domain: `storage-rules` · Date: 2026-07-17

## Purpose

Close the multi-tenant security gap in Firebase Storage. Today `storage.rules` only verifies `request.auth != null`, allowing any authenticated user to read/write/delete files across all companies. This spec extends the same `isMember(companyId)` pattern proven in `firestore.rules` to every Storage path, scoping access exclusively to company members.

**Existing prior spec** at `openspec/specs/storage-rules/spec.md` covered `documentos/` for the `sistema-medios-desacoplado` change. This spec supersedes it by covering all Storage paths (`documentos/`, `ejecuciones/`, `extractos/`) with unified membership verification.

## Firestore `isMember()` Reference — must be replicated verbatim

The `isMember(companyId)` function in `storage.rules` SHALL mirror the following from `firestore.rules`, adapted for Storage rules syntax:

```javascript
function isMember(companyId) {
  return request.auth != null &&
    firestore.exists(
      /databases/(default)/documents/companies/$(companyId)/members/$(request.auth.uid)
    );
}
```

The function SHALL verify both:
1. User is authenticated (`request.auth != null`)
2. A Firestore document exists at `companies/{companyId}/members/{auth.uid}`

## Requirements

### R1: Membership-Based Access Control — All Paths

Every Storage operation on company-scoped paths SHALL verify `isMember(companyId)` before granting access. No operation SHALL be granted on `request.auth != null` alone.

Affected paths:
| Path pattern | Current gate | New gate |
|---|---|---|
| `/{companyId}/ejecuciones/{ejecucionId}/{fileName}` | `request.auth != null` | `isMember(companyId)` |
| `/{companyId}/documentos/{fileName}` | `request.auth != null` | `isMember(companyId)` |
| `/{companyId}/extractos/{fileName}` | `request.auth != null` | `isMember(companyId)` |
| `/{companyId}/ejecuciones/{allPaths=**}` (list) | `request.auth != null` | `isMember(companyId)` |

#### Scenario: Intra-company read allowed

- GIVEN a user who is a member of company `abc`
  - (i.e. `companies/abc/members/{auth.uid}` exists in Firestore)
- WHEN they attempt to read `companies/abc/documentos/invoice.pdf`
- THEN the read is allowed

#### Scenario: Intra-company write allowed

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to upload a file to `companies/abc/ejecuciones/e1/receipt.jpg`
- AND the file meets size and contentType constraints
- THEN the write is allowed

#### Scenario: Cross-company read denied

- GIVEN a user who is a member of company `abc`
  - (i.e. `companies/abc/members/{auth.uid}` exists, but `companies/xyz/members/{auth.uid}` does NOT)
- WHEN they attempt to read `companies/xyz/documentos/report.pdf`
- THEN the read is denied (403)

#### Scenario: Cross-company write denied

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to upload a file to `companies/xyz/ejecuciones/e1/leak.jpg`
- THEN the write is denied (403)

#### Scenario: Cross-company list denied

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to list files under `companies/xyz/ejecuciones/`
- THEN the list is denied (403)

#### Scenario: Cross-company delete denied

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to delete `companies/xyz/extractos/statement.pdf`
- THEN the delete is denied (403)

#### Scenario: Member writes to own ejecuciones path

- GIVEN a user who is a member of company `abc`
- WHEN they upload a file to `companies/abc/ejecuciones/e1/comprobante.pdf`
- AND `comprobante.pdf` is under 5 MB
- AND `comprobante.pdf` has contentType `application/pdf`
- THEN the write is allowed

#### Scenario: Member lists ejecuciones in own company

- GIVEN a user who is a member of company `abc`
- WHEN they list `companies/abc/ejecuciones/`
- THEN the list is allowed

### R2: Unauthenticated Access — Global Deny

Any Storage operation by an unauthenticated user SHALL be denied across all company-scoped paths.

#### Scenario: Unauthenticated read denied

- GIVEN a user who is NOT authenticated (`request.auth == null`)
- WHEN they attempt to read any file under any company path
- THEN the operation is denied (403)

#### Scenario: Unauthenticated write denied

- GIVEN a user who is NOT authenticated
- WHEN they attempt to upload any file to any company path
- THEN the operation is denied (403)

#### Scenario: Unauthenticated delete denied

- GIVEN a user who is NOT authenticated
- WHEN they attempt to delete any file under any company path
- THEN the operation is denied (403)

#### Scenario: Unauthenticated list denied

- GIVEN a user who is NOT authenticated
- WHEN they attempt to list files under `ejecuciones/` for any company
- THEN the operation is denied (403)

### R3: Write Constraints — Preserved per Path

Each path SHALL retain its existing write constraints (size limit and allowed content types) IN ADDITION TO the new `isMember(companyId)` check. The membership check SHALL NOT replace the existing constraints.

| Path | Max size | Allowed MIME types |
|---|---|---|
| `documentos/` | 10 MB | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |
| `ejecuciones/` | 5 MB | `image/jpeg`, `image/png`, `application/pdf` |
| `extractos/` | 10 MB | `application/pdf` |

#### Scenario: Oversized file denied despite membership

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to upload a 15 MB file to `companies/abc/documentos/report.pdf`
- THEN the write is denied (constraint: size < 10 MB)

#### Scenario: Wrong MIME type denied despite membership

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to upload `script.exe` to `companies/abc/ejecuciones/e1/payload.exe`
- THEN the write is denied (constraint: contentType matches)

#### Scenario: Valid ejecuciones upload with both checks

- GIVEN a user who is a member of company `abc`
- WHEN they upload a 3 MB `receipt.jpg` to `companies/abc/ejecuciones/e1/receipt.jpg`
- THEN the write is allowed (membership ✓, size ✓, contentType ✓)

#### Scenario: Valid extractos upload

- GIVEN a user who is a member of company `abc`
- WHEN they upload a 2 MB `statement.pdf` to `companies/abc/extractos/statement.pdf`
- THEN the write is allowed (membership ✓, size ✓, contentType ✓)

### R4: Delete Policy — Unified per Path

Delete rules SHALL be unified across paths as follows:

| Path | Current delete rule | New delete rule | Rationale |
|---|---|---|---|
| `documentos/` | `if false` | `if false` | Physical cleanup via GC only — no change |
| `ejecuciones/` | `if request.auth != null` | `if isMember(companyId)` | Members may delete their ejecucion files |
| `extractos/` | `if request.auth != null` | `if isMember(companyId)` | Members may delete extract files |

#### Scenario: Documentos delete denied (unchanged)

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to delete a file at `companies/abc/documentos/invoice.pdf`
- THEN the delete is denied
- AND the rule remains `allow delete: if false`

#### Scenario: Ejecuciones delete allowed for member

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to delete a file at `companies/abc/ejecuciones/e1/comprobante.pdf`
- THEN the delete is allowed

#### Scenario: Ejecuciones delete denied for non-member

- GIVEN a user who is a member of company `xyz` (but NOT of `abc`)
- WHEN they attempt to delete `companies/abc/ejecuciones/e1/comprobante.pdf`
- THEN the delete is denied (403)

#### Scenario: Extractos delete allowed for member

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to delete `companies/abc/extractos/statement.pdf`
- THEN the delete is allowed

#### Scenario: Extractos delete denied for non-member

- GIVEN a user who is NOT a member of company `abc`
- WHEN they attempt to delete `companies/abc/extractos/statement.pdf`
- THEN the delete is denied (403)

### R5: Catch-All — Unmatched Paths

Any Storage path not explicitly matched by the rules above SHALL be denied for all operations.

#### Scenario: Unknown path denied

- GIVEN any authenticated user
- WHEN they attempt to read/write an arbitrary path like `some-other-bucket/unexpected/file.pdf`
- THEN the operation is denied (403)

## Edge Cases

### EC1: CompanyId path traversal

- GIVEN a user who is a member of company `abc`
- WHEN they attempt to read `companies/../malicious/documentos/hack.pdf`
- THEN the operation is denied
- RATIONALE: Storage path segments are literal; `..` is NOT resolved as directory traversal by Firebase Storage. The `{companyId}` wildcard matches as a literal string.

### EC2: CompanyId with special characters

- GIVEN a company with ID containing special characters (e.g., `abc-123_def`)
- GIVEN a user who is a member of that company
- WHEN they attempt to read `companies/abc-123_def/documentos/file.pdf`
- THEN the read is allowed
- RATIONALE: `isMember(companyId)` passes the literal `companyId` to `firestore.exists()`. If the company document ID matches, membership is verified.

### EC3: User is member of multiple companies

- GIVEN a user who is a member of both company `abc` and company `xyz`
- WHEN they attempt to read `companies/abc/documentos/a.pdf`
- AND `companies/xyz/documentos/b.pdf`
- THEN both reads are allowed
- AND the same user attempting to read `companies/other/documentos/c.pdf` is denied
- RATIONALE: `isMember(companyId)` checks membership per company independently. Membership in one company does not imply membership in another.

### EC4: Firestore read latency on cold start

- GIVEN a Storage rule that calls `firestore.exists()` for the first time in ~5 minutes
- WHEN a member attempts a read
- THEN the read SHALL succeed after a small additional latency (~50–150ms)
- RATIONALE: Firebase runtime caches `firestore.exists()` results for approximately 5 minutes. Cold starts incur a Firestore read. This is an acceptable tradeoff for security.

### EC5: Document deleted from Firestore mid-session

- GIVEN a user whose membership document `companies/abc/members/{uid}` exists at rule evaluation time
- WHEN they initiate a read
- THEN the read is allowed
- RATIONALE: The Firebase runtime evaluates the rule at request time using the document state at that instant. If the membership is deleted between rule evaluation and data delivery, the read already succeeded. This is consistent with Firestore rules behavior.

### EC6: Storage rule deploy without Firestore changes

- GIVEN a deployment of ONLY `storage.rules` (no Firestore changes)
- WHEN `firebase deploy --only storage` is executed
- THEN the new rules take effect immediately
- AND no Firestore indexes or schema changes are required
- RATIONALE: `isMember()` uses `firestore.exists()` which requires no Firestore rule changes. The Firestore data path `companies/{companyId}/members/{auth.uid}` already exists.

## Non-Requirements

The following are explicitly NOT required by this spec:

- **Admin SDK bypass**: Firebase Admin SDK (used by `garbage-collector-media.ts`) bypasses Storage rules entirely. Admin operations are not subject to these rules. The GC script's prefix discrepancy (`companies/` in Firestore paths vs. actual Storage paths) is documented as technical debt — see plan in proposal.
- **User blocked status**: `isMember(companyId)` does NOT verify whether the user is `blocked` or `active`. This mirrors the same behavior in `firestore.rules`. Adding blocked-user filtering is a future concern.
- **Custom auth claims**: This spec does not use Firebase custom claims for storage access. All access control is driven by Firestore membership documents.
- **New Storage paths**: This spec covers only `documentos/`, `ejecuciones/`, and `extractos/`. New paths added in the future must follow the same `isMember(companyId)` pattern.
