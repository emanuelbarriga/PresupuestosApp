/**
 * Storage Security Rules Tests — Ejecuciones Path
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
 *     npx vitest run lib/__tests__/storage-rules-ejecuciones.test.ts
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

describe('companies/{companyId}/ejecuciones/{ejecucionId}/{fileName} — storage.rules', () => {
  const companyId = 'test-company';
  const otherCompanyId = 'other-company';
  const memberUid = 'member-user';
  const nonMemberUid = 'stranger';
  const ejecucionId = 'ej-001';
  const testFileName = 'comprobante.pdf';

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
      const storageRef = ref(
        storage,
        `companies/${companyId}/ejecuciones/${ejecucionId}/${testFileName}`,
      );
      const blob = new Blob(['%PDF-1.4 test content'], { type: 'application/pdf' });
      await uploadBytes(storageRef, blob);
    });
  });

  // ── Intra-company: Read ─────────────────────────────────────────────

  it('allows member to read an ejecucion file', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/${testFileName}`,
    );
    await assertSucceeds(getDownloadURL(storageRef));
  });

  // ── Intra-company: Write ────────────────────────────────────────────

  it('allows member to upload a valid file to ejecuciones', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/receipt.jpg`,
    );
    const blob = new Blob(['fake jpeg'], { type: 'image/jpeg' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  // ── Intra-company: List ─────────────────────────────────────────────

  it('allows member to list ejecuciones', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${companyId}/ejecuciones/`);
    await assertSucceeds(listAll(storageRef));
  });

  // ── Intra-company: Delete ───────────────────────────────────────────

  it('allows member to delete an ejecucion file', async () => {
    // Upload a file first as the member
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const deleteRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/to-delete.pdf`,
    );
    const blob = new Blob(['delete test'], { type: 'application/pdf' });
    await assertSucceeds(uploadBytes(deleteRef, blob));
    // Now delete it — should succeed for member
    await assertSucceeds(deleteObject(deleteRef));
  });

  // ── Cross-company: Deny ─────────────────────────────────────────────

  it('denies cross-company read', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${otherCompanyId}/ejecuciones/${ejecucionId}/${testFileName}`,
    );
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies cross-company write', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${otherCompanyId}/ejecuciones/${ejecucionId}/leak.jpg`,
    );
    const blob = new Blob(['leak'], { type: 'image/jpeg' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies cross-company list', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(memberStorage, `companies/${otherCompanyId}/ejecuciones/`);
    await assertFails(listAll(storageRef));
  });

  it('denies cross-company delete', async () => {
    // First upload the file with admin privileges on otherCompanyId
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const storage = ctx.storage();
      const storageRef = ref(
        storage,
        `companies/${otherCompanyId}/ejecuciones/${ejecucionId}/cross-delete.pdf`,
      );
      const blob = new Blob(['cross delete test'], { type: 'application/pdf' });
      await uploadBytes(storageRef, blob);
    });

    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${otherCompanyId}/ejecuciones/${ejecucionId}/cross-delete.pdf`,
    );
    await assertFails(deleteObject(storageRef));
  });

  // ── Non-member: Deny ────────────────────────────────────────────────

  it('denies non-member read', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(
      strangerStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/${testFileName}`,
    );
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies non-member write', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(
      strangerStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/stranger.pdf`,
    );
    const blob = new Blob(['stranger'], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies non-member delete', async () => {
    const strangerStorage = testEnv.authenticatedContext(nonMemberUid).storage();
    const storageRef = ref(
      strangerStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/${testFileName}`,
    );
    await assertFails(deleteObject(storageRef));
  });

  // ── Unauthenticated: Deny ───────────────────────────────────────────

  it('denies unauthenticated read', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(
      unauthStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/${testFileName}`,
    );
    await assertFails(getDownloadURL(storageRef));
  });

  it('denies unauthenticated write', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(
      unauthStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/unauth.pdf`,
    );
    const blob = new Blob(['unauth'], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('denies unauthenticated delete', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(
      unauthStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/${testFileName}`,
    );
    await assertFails(deleteObject(storageRef));
  });

  it('denies unauthenticated list', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const storageRef = ref(unauthStorage, `companies/${companyId}/ejecuciones/`);
    await assertFails(listAll(storageRef));
  });

  // ── Write Constraints ───────────────────────────────────────────────

  it('rejects oversized file (>5MB)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/big-file.pdf`,
    );
    const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: 'application/pdf' });
    await assertFails(uploadBytes(storageRef, largeBlob));
  });

  it('rejects wrong MIME type (script.exe)', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/payload.exe`,
    );
    const blob = new Blob(['fake exe'], { type: 'application/x-msdownload' });
    await assertFails(uploadBytes(storageRef, blob));
  });

  it('allows JPEG upload to ejecuciones', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/photo.jpg`,
    );
    const blob = new Blob(['fake jpeg'], { type: 'image/jpeg' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  it('allows PNG upload to ejecuciones', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/img.png`,
    );
    const blob = new Blob(['fake png'], { type: 'image/png' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });

  it('allows PDF upload to ejecuciones', async () => {
    const memberStorage = testEnv.authenticatedContext(memberUid).storage();
    const storageRef = ref(
      memberStorage,
      `companies/${companyId}/ejecuciones/${ejecucionId}/doc.pdf`,
    );
    const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    await assertSucceeds(uploadBytes(storageRef, blob));
  });
});
