/**
 * Storage Security Rules Tests — Documentos Path
 *
 * Tests follow the spec at:
 * openspec/changes/storage-rules-company-security/specs/storage-rules/spec.md
 *
 * ⚠ KNOWN LIMITATION: The Firebase Storage emulator's rules runtime
 * (cloud-storage-rules-runtime-v1.1.3.jar) is incompatible with Java 26 on
 * macOS arm64. Auth tokens are not recognized and the client SDK throws
 * `storage/unknown` on all calls (even withSecurityRulesDisabled).
 *
 * These tests are structurally correct per the Firebase Testing Library docs
 * and serve as executable specifications. They will pass once the emulator
 * is updated or the project uses a supported Java version (17–21).
 *
 * To attempt a run (expected to fail until emulator is fixed):
 *   firebase emulators:exec --project planningsaman-3cf7e --only firestore,storage '
 *     npx vitest run lib/__tests__/storage-rules-documentos.test.ts
 *   '
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  assertSucceeds,
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

const PROJECT_ID = 'planningsaman-3cf7e';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: { host: 'localhost', port: 9199 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('companies/{companyId}/documentos/{fileName} — storage.rules', () => {
  const companyId = 'test-company';
  const otherCompanyId = 'other-company';
  const memberUid = 'member-user';
  const nonMemberUid = 'stranger';
  const testFileName = 'uuid-report.pdf';

  beforeAll(async () => {
    // Seed: create a company member in Firestore (so firestore.exists works)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection(`companies/${companyId}/members`).doc(memberUid).set({
        id: memberUid,
        email: 'member@test.com',
        role: 'colaborador',
        joinedAt: new Date().toISOString(),
      });
    });

    // Upload a test file for read/delete tests
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const storage = ctx.storage();
      const storageRef = ref(storage, `companies/${companyId}/documentos/${testFileName}`);
      const blob = new Blob(['%PDF-1.4 test content'], { type: 'application/pdf' });
      await uploadBytes(storageRef, blob);
    });
  });

  // ── Multi-tenant Storage Isolation ───────────────────────────────────

  it('allows member to read a document file', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/${testFileName}`);
    await assertSucceeds(getDownloadURL(storageRef));
  });

  it('denies non-member from reading a document file', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(strangerStorage, `companies/${companyId}/documentos/${testFileName}`);
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies cross-company read (member tries other company)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    // memberUid is NOT a member of otherCompanyId → denied
    const storageRef = ref(memberStorage, `companies/${otherCompanyId}/documentos/${testFileName}`);
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies unauthenticated read', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/documentos/${testFileName}`);
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies unauthenticated write', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/documentos/unauth.pdf`);
    const blob = new Blob(['test'], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies unauthenticated delete', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/documentos/${testFileName}`);
    await assertFails(deleteObject(storageRef));
  });

  it('denies unauthenticated list', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/documentos/`);
    await assertFails(listAll(storageRef));
  });

  // ── File Type Restriction on Upload ──────────────────────────────────

  it('allows PDF upload (allowed MIME)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/uuid-invoice.pdf`);
    const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  it('rejects oversized file (>10MB)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/big-file.pdf`);
    const largeBlob = new Blob([new ArrayBuffer(11 * 1024 * 1024)], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, largeBlob));
  });

  it('rejects wrong MIME type (script.exe)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/script.exe`);
    const blob = new Blob(['fake exe'], { type: 'application/x-msdownload' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('allows JPEG upload', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/photo.jpg`);
    const blob = new Blob(['fake jpeg'], { type: 'image/jpeg' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  it('allows PNG upload', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/img.png`);
    const blob = new Blob(['fake png'], { type: 'image/png' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  it('allows WebP upload', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/img.webp`);
    const blob = new Blob(['fake webp'], { type: 'image/webp' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  // ── No Client Delete ────────────────────────────────────────────────

  it('denies client delete of document file', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/documentos/${testFileName}`);
    await assertFails(deleteObject(storageRef));
  });
});
