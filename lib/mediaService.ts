import {
  collection,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DocumentoMedio, DocumentoStatus, TipoDocumentoMedio, DocumentSource } from './types';

/**
 * Subscribe to real-time updates on /documentos collection.
 * Uses equality filters for optimal Firestore querying — no client-side filtering.
 * Requires composite index: status ASC, _source ASC (create via Firebase Console or firestore.indexes.json).
 */
export function subscribeDocumentos(
  companyId: string,
  filters: {
    status?: DocumentoStatus;
    tipoDocumento?: TipoDocumentoMedio;
    source?: DocumentSource;
  } = {},
  onData: (docs: DocumentoMedio[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = collection(db, `companies/${companyId}/documentos`);
  const constraints: ReturnType<typeof where>[] = [];

  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.tipoDocumento) constraints.push(where('tipoDocumento', '==', filters.tipoDocumento));
  if (filters?.source) constraints.push(where('_source', '==', filters.source));

  const q = constraints.length > 0 ? query(ref, ...constraints) : ref;

  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data } as DocumentoMedio;
      });
      onData(docs);
    },
    onError,
  );
}

/**
 * Create a new DocumentoMedio record in Firestore.
 * Sets uploadedAt, createdBy, and overrides _source.
 */
export async function createDocumento(
  companyId: string,
  data: Omit<DocumentoMedio, 'id' | 'uploadedAt' | 'updatedAt'>,
  userId: string,
  source: DocumentSource = 'inbox-upload',
): Promise<string> {
  const docRef = await addDoc(collection(db, `companies/${companyId}/documentos`), {
    ...data,
    _source: source,
    uploadedAt: new Date().toISOString(),
    createdBy: userId,
  });
  return docRef.id;
}

/**
 * Get a single DocumentoMedio by ID. Returns null if not found.
 */
export async function getDocumento(
  companyId: string,
  documentoId: string,
): Promise<DocumentoMedio | null> {
  const docSnap = await getDoc(doc(db, `companies/${companyId}/documentos`, documentoId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as DocumentoMedio;
}
