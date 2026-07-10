import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  url: string;
  path: string;
}

export function validateFile(file: File): { valid: true } | { valid: false; error: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo no soportado: ${file.type}. Permitidos: PDF, JPG, PNG`,
    };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo: 5MB`,
    };
  }
  return { valid: true };
}

/**
 * Generate a unique Storage path for a comprobante file.
 * Format: {companyId}/ejecuciones/{ejecucionId}/{uuid}-{sanitizedName}
 */
export function generateFilePath(
  companyId: string,
  ejecucionId: string,
  fileName: string,
): string {
  const uuid = crypto.randomUUID();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${companyId}/ejecuciones/${ejecucionId}/${uuid}-${sanitized}`;
}

/**
 * Upload a file to Firebase Storage with progress tracking.
 * Returns the download URL and storage path on success.
 */
export async function uploadFile(
  file: Blob | ArrayBuffer | Uint8Array,
  path: string,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  const storageRef = ref(storage, path);
  // Si no es Blob (File), agregar contentType explícito para que pase
  // la regla de Storage que requiere application/pdf
  const metadata = file instanceof Blob ? undefined : { contentType: 'application/pdf' };
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, path });
      },
    );
  });
}

/**
 * Delete a file from Firebase Storage by its path.
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}
