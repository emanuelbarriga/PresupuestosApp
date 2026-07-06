import { ref, getBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Download PDF bytes from Firebase Storage using the SDK (no CORS issues).
 * Falls back to fetch() if the URL doesn't contain a recognizable storage path.
 */
export async function downloadPdfBytes(
  pdfUrl: string,
  storagePath?: string,
): Promise<ArrayBuffer> {
  // If we have the storage path, use the SDK — no CORS issues
  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    return await getBytes(storageRef);
  }

  // Try to extract the path from the download URL
  // Format: /v0/b/{bucket}/o/{encoded_path}?alt=media&token={token}
  try {
    const url = new URL(pdfUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)/);
    if (pathMatch) {
      const decodedPath = decodeURIComponent(pathMatch[1]);
      const storageRef = ref(storage, decodedPath);
      return await getBytes(storageRef);
    }
  } catch {
    // URL parsing failed, fall through to fetch
  }

  // Last resort: raw fetch (may have CORS issues in some environments)
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`Error al descargar el PDF: ${response.status}`);
  return await response.arrayBuffer();
}
