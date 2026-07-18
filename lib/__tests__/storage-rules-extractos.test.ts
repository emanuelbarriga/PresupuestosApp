/**
 * Storage Security Rules Tests — Extractos Path
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
 *     npx vitest run lib/__tests__/storage-rules-extractos.test.ts
 *   '
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  assertSucceeds,
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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

describe('companies/{companyId}/extractos/{fileName} — storage.rules', () => {
  const companyId = 'test-company';
  const otherCompanyId = 'other-company';
  const memberUid = 'member-user';
  const nonMemberUid = 'stranger';
  const testFileName = 'statement.pdf';

  beforeAll(async () => {
    // Seed: create a company member in Firestore
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
      const storageRef = ref(storage, `companies/${companyId}/extractos/${testFileName}`);
      const blob = new Blob(['%PDF-1.4 bank statement'], { type: 'application/pdf' });
      await uploadBytes(storageRef, blob);
    });
  });

  // ── Intra-company: Read ─────────────────────────────────────────────

  it('allows member to read an extracto file', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/extractos/${testFileName}`);
    await assertSucceeds(getDownloadURL(storageRef));
  });

  // ── Intra-company: Write ────────────────────────────────────────────

  it('allows member to upload a valid PDF to extractos', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/extractos/new-statement.pdf`);
    const blob = new Blob(['%PDF-1.4 new statement'], { type: 'application/pdf' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  // ── Intra-company: Delete ───────────────────────────────────────────

  it('allows member to delete an extracto file', async () => {
    // Upload a file first as the member
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const deleteRef = ref(memberStorage, `companies/${companyId}/extractos/to-delete.pdf`);
    const blob = new Blob(['delete test'], { type: 'application/pdf' });
    await assertSucceeds(uploadBytes(deleteRef, blob));
    // Now delete it — should succeed for member
    await assertSucceeds(deleteObject(deleteRef));
  });

  // ── Cross-company: Deny ─────────────────────────────────────────────

  it('denies cross-company read', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${otherCompanyId}/extractos/${testFileName}`);
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies cross-company write', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${otherCompanyId}/extractos/leak.pdf`);
    const blob = new Blob(['leak'], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies cross-company delete', async () => {
    // First upload the file with admin privileges on otherCompanyId
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const storage = ctx.storage();
      const storageRef = ref(
        storage,
        `companies/${otherCompanyId}/extractos/cross-delete.pdf`,
      );
      const blob = new Blob(['cross delete test'], { type: 'application/pdf' });
      await uploadBytes(storageRef, blob);
    });

    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${otherCompanyId}/extractos/cross-delete.pdf`);
    await assertFails(deleteObject(storageRef));
  });

  // ── Non-member: Deny ────────────────────────────────────────────────

  it('denies non-member read', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(strangerStorage, `companies/${companyId}/extractos/${testFileName}`);
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies non-member write', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(strangerStorage, `companies/${companyId}/extractos/stranger.pdf`);
    const blob = new Blob(['stranger'], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies non-member delete', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(strangerStorage, `companies/${companyId}/extractos/${testFileName}`);
    await assertFails(deleteObject(storageRef));
  });

  // ── Unauthenticated: Deny ───────────────────────────────────────────

  it('denies unauthenticated read', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/extractos/${testFileName}`);
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies unauthenticated write', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/extractos/unauth.pdf`);
    const blob = new Blob(['unauth'], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies unauthenticated delete', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/extractos/${testFileName}`);
    await assertFails(deleteObject(storageRef));
  });

  // ── Write Constraints ───────────────────────────────────────────────

  it('rejects oversized file (>10MB)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/extractos/big-file.pdf`);
    const largeBlob = new Blob([new ArrayBuffer(11 * 1024 * 1024)], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, largeBlob));
  });

  it('rejects wrong MIME type (JPEG not allowed in extractos)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/extractos/photo.jpg`);
    const blob = new Blob(['fake jpeg'], { type: 'image/jpeg' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('rejects wrong MIME type (PNG not allowed in extractos)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/extractos/img.png`);
    const blob = new Blob(['fake png'], { type: 'image/png' });
    await assertFails(uploadBytes(storageRef, blob));
  });
});
