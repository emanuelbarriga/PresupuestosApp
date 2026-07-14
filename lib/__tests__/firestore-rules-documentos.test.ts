/**
 * Firestore Security Rules Tests — Documentos Collection
 *
 * These tests require the Firestore emulator running on localhost:8081.
 * Run with: firebase emulators:start --only auth,firestore
 * Then:     npx vitest run lib/__tests__/firestore-rules-documentos.test.ts
 *
 * Tests follow the spec at:
 * openspec/changes/sistema-medios-desacoplado/specs/firestore-rules/spec.md
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  assertSucceeds,
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';

const PROJECT_ID = 'planningsaman-3cf7e';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('/companies/{companyId}/documentos/{doc} — firestore.rules', () => {
  const companyId = 'test-company';
  const memberUid = 'member-user';
  const nonMemberUid = 'stranger';

  beforeAll(async () => {
    // Seed: create a company member
    await testEnv.withSecurityRulesDisabled(async (db) => {
      await setDoc(doc(db, `companies/${companyId}/members/${memberUid}`), {
        id: memberUid,
        email: 'member@test.com',
        role: 'colaborador',
        joinedAt: new Date().toISOString(),
      });
    });
  });

  // ── Multi-tenant Read/Write Isolation ────────────────────────────────

  it('allows company member to read documentos', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, `companies/${companyId}/documentos/some-doc`)),
    );
  });

  it('denies non-member to read documentos', async () => {
    const strangerDb = testEnv.authenticatedContext(nonMemberUid).firestore();
    await assertFails(
      getDoc(doc(strangerDb, `companies/${companyId}/documentos/some-doc`)),
    );
  });

  // ── Field Validation on Create ────────────────────────────────────────

  it('denies create with missing required fields', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    await assertFails(
      setDoc(doc(memberDb, `companies/${companyId}/documentos/incomplete`), {
        fileName: 'test.pdf',
        // missing storagePath, mimeType, size, status, uploadedAt
      }),
    );
  });

  it('allows create with all required fields', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, `companies/${companyId}/documentos/new-doc`), {
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'por_clasificar',
        uploadedAt: new Date().toISOString(),
      }),
    );
  });

  // ── Status Transition Validation ──────────────────────────────────────

  it('allows valid status transition por_clasificar → enlazado', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, `companies/${companyId}/documentos/status-test`), {
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'por_clasificar',
        uploadedAt: new Date().toISOString(),
      }),
    );
    // Transition to enlazado
    await assertSucceeds(
      setDoc(doc(memberDb, `companies/${companyId}/documentos/status-test`), {
        status: 'enlazado',
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedAt: new Date().toISOString(),
      }),
    );
  });

  it('blocks status transition enlazado → por_clasificar without clearing ejecucionIds', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    // First set a doc with enlazado status and a non-empty ejecucionIds
    await testEnv.withSecurityRulesDisabled(async (db) => {
      await setDoc(doc(db, `companies/${companyId}/documentos/linked-doc`), {
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'enlazado',
        ejecucionIds: ['ej-001'],
        uploadedAt: new Date().toISOString(),
      });
    });
    // Try to set status to por_clasificar while keeping ejecucionIds = ['ej-001']
    await assertFails(
      setDoc(doc(memberDb, `companies/${companyId}/documentos/linked-doc`), {
        status: 'por_clasificar',
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        ejecucionIds: ['ej-001'], // NOT cleared
        uploadedAt: new Date().toISOString(),
      }),
    );
  });

  it('allows status transition enlazado → por_clasificar with ejecucionIds cleared', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    await testEnv.withSecurityRulesDisabled(async (db) => {
      await setDoc(doc(db, `companies/${companyId}/documentos/cleared-doc`), {
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'enlazado',
        ejecucionIds: ['ej-001'],
        uploadedAt: new Date().toISOString(),
      });
    });
    // Set status to por_clasificar WITH clearing ejecucionIds
    await assertSucceeds(
      setDoc(doc(memberDb, `companies/${companyId}/documentos/cleared-doc`), {
        status: 'por_clasificar',
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        ejecucionIds: [], // cleared
        uploadedAt: new Date().toISOString(),
      }),
    );
  });

  // ── No Client Delete ────────────────────────────────────────────────

  it('denies client delete of documentos', async () => {
    const memberDb = testEnv.authenticatedContext(memberUid).firestore();
    await testEnv.withSecurityRulesDisabled(async (db) => {
      await setDoc(doc(db, `companies/${companyId}/documentos/to-delete`), {
        fileName: 'test.pdf',
        storagePath: 'c1/documentos/uuid-test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        status: 'por_clasificar',
        uploadedAt: new Date().toISOString(),
      });
    });
    await assertFails(
      deleteDoc(doc(memberDb, `companies/${companyId}/documentos/to-delete`)),
    );
  });
});
