import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Mock Firebase Storage ──────────────────────────────────────────────

const mockUploadTask = {
  on: vi.fn(),
  snapshot: { ref: 'mock-ref' },
};

const { ref, uploadBytesResumable, getDownloadURL, deleteObject } = vi.hoisted(() => ({
  ref: vi.fn((_s, p) => p),
  uploadBytesResumable: vi.fn(() => mockUploadTask),
  getDownloadURL: vi.fn().mockResolvedValue('https://storage.example.com/file.pdf'),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/storage', () => ({
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
}));

vi.mock('@/lib/firebase', () => ({
  storage: {},
}));

// ─── Imports ────────────────────────────────────────────────────────────

import { validateFile, generateFilePath, uploadFile, deleteFile } from '@/lib/fileUpload';

// ─── Tests ──────────────────────────────────────────────────────────────

describe('validateFile', () => {
  it('rejects unknown type (GIF)', () => {
    const file = new File([''], 'test.gif', { type: 'image/gif' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('image/gif');
    }
  });

  it('rejects oversized file (>5MB)', () => {
    const oversized = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    const result = validateFile(oversized);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('5MB');
    }
  });

  it('accepts valid PDF', () => {
    const file = new File([''], 'doc.pdf', { type: 'application/pdf' });
    expect(validateFile(file)).toEqual({ valid: true });
  });

  it('accepts valid JPG', () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateFile(file)).toEqual({ valid: true });
  });

  it('accepts valid PNG', () => {
    const file = new File([''], 'img.png', { type: 'image/png' });
    expect(validateFile(file)).toEqual({ valid: true });
  });
});

describe('generateFilePath', () => {
  it('uses correct path format', () => {
    const path = generateFilePath('emp-1', 'ej-123', 'factura.pdf');
    expect(path).toMatch(/^emp-1\/ejecuciones\/ej-123\/[a-f0-9-]+-factura\.pdf$/);
  });

  it('sanitizes unsafe characters in file name', () => {
    const path = generateFilePath('c1', 'e1', 'Mi Factura (2).pdf');
    // Spaces and parens become underscores; only a-z A-Z 0-9 . _ - survive
    expect(path).toContain('c1/ejecuciones/e1/');
    // Check that unsafe chars are sanitized (the actual sanitize behavior)
    expect(path).not.toContain(' Factura ');
    expect(path).not.toContain('(');
    expect(path).not.toContain(')');
    // Should end with .pdf
    expect(path).toMatch(/\.pdf$/);
  });
});

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls uploadBytesResumable with correct args', async () => {
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const uploadPromise = uploadFile(file, 'c1/ejecuciones/e1/uuid-doc.pdf');

    // Simulate successful upload
    const stateChanged = mockUploadTask.on.mock.calls[0];
    expect(stateChanged[0]).toBe('state_changed');

    // Call progress callback
    const onProgress = vi.fn();
    uploadFile(file, 'c1/ejecuciones/e1/uuid-doc.pdf', onProgress);

    const snapshotCallback = mockUploadTask.on.mock.calls[1][1];
    snapshotCallback({ bytesTransferred: 512, totalBytes: 1024 });

    expect(onProgress).toHaveBeenCalledWith(50);

    // Complete upload
    const completeCallback = mockUploadTask.on.mock.calls[1][3];
    await completeCallback();

    expect(getDownloadURL).toHaveBeenCalledWith('mock-ref');
  });

  it('rejects on upload error', async () => {
    const file = new File([''], 'doc.pdf', { type: 'application/pdf' });
    const uploadPromise = uploadFile(file, 'path');

    const errorCallback = mockUploadTask.on.mock.calls[0][2];
    errorCallback(new Error('Upload failed'));

    await expect(uploadPromise).rejects.toThrow('Upload failed');
  });
});

describe('deleteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteObject with correct ref', async () => {
    await deleteFile('c1/ejecuciones/e1/uuid-doc.pdf');

    expect(ref).toHaveBeenCalledWith({}, 'c1/ejecuciones/e1/uuid-doc.pdf');
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });
});
