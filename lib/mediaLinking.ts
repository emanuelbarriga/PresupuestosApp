import {
  doc,
  runTransaction,
  getDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import type { TipoDocumentoMedio, DocumentoMedioMetadata } from './types';
import { derivarEstadoComprobantes } from './comprobantes';

export type LinkingDiff = {
  added: string[];
  removed: string[];
  kept: string[];
};

/**
 * Pure function: compute which ejecucionIds were added, removed, or kept
 * when comparing current vs new arrays.
 */
export function computeLinkingDiff(currentIds: string[], newIds: string[]): LinkingDiff {
  const currentSet = new Set(currentIds);
  const newSet = new Set(newIds);

  return {
    added: newIds.filter((id) => !currentSet.has(id)),
    removed: currentIds.filter((id) => !newSet.has(id)),
    kept: currentIds.filter((id) => newSet.has(id)),
  };
}

interface LinkData {
  tipoDocumento: TipoDocumentoMedio;
  periodo: string;
  terceroId: string;
  projectId?: string;
  ejecucionIds: string[];
  metadata?: DocumentoMedioMetadata;
}

/**
 * Link a DocumentoMedio to one or more ejecuciones atomically.
 *
 * Uses Firestore runTransaction to:
 * 1. Read the DocumentoMedio doc
 * 2. Compute diff vs current ejecucionIds
 * 3. For each new/kept ejecucion: push to _linkedDocumentos, recalc _estadoComprobantes
 * 4. For each removed ejecucion: remove from _linkedDocumentos, recalc _estadoComprobantes
 * 5. Update DocumentoMedio with status 'enlazado' and field data
 */
export async function linkDocumentoToEntities(
  companyId: string,
  documentoId: string,
  data: LinkData,
): Promise<void> {
  const documentoRef = doc(db, `companies/${companyId}/documentos`, documentoId);

  await runTransaction(db, async (transaction) => {
    // 1. Read the DocumentoMedio
    const docSnap = await transaction.get(documentoRef);
    if (!docSnap.exists()) {
      throw new Error(`DocumentoMedio ${documentoId} not found`);
    }

    const docData = docSnap.data();
    const currentEjecucionIds: string[] = docData.ejecucionIds ?? [];
    const diff = computeLinkingDiff(currentEjecucionIds, data.ejecucionIds);

    // 2. For each NEW ejecucionId: read, push _linkedDocumentos, recalc
    for (const ejId of diff.added) {
      const ejRef = doc(db, `companies/${companyId}/ejecuciones`, ejId);
      const ejSnap = await transaction.get(ejRef);
      if (!ejSnap.exists()) continue;

      const ejData = ejSnap.data();
      const currentLinked: Array<{ documentoId: string; tipoDocumento: string; periodo?: string; montoTotal?: number; proveedorTexto?: string }> =
        ejData._linkedDocumentos ?? [];

      const newEntry = {
        documentoId,
        tipoDocumento: data.tipoDocumento,
        periodo: data.periodo,
        montoTotal: data.metadata?.montoTotal,
        proveedorTexto: data.metadata?.proveedorTexto,
      };

      const updatedLinked = [...currentLinked, newEntry];
      const estado = derivarEstadoComprobantes(updatedLinked);

      transaction.update(ejRef, {
        _linkedDocumentos: updatedLinked,
        _estadoComprobantes: estado.estado,
      });
    }

    // 3. For each REMOVED ejecucionId: remove from _linkedDocumentos, recalc
    for (const ejId of diff.removed) {
      const ejRef = doc(db, `companies/${companyId}/ejecuciones`, ejId);
      const ejSnap = await transaction.get(ejRef);
      if (!ejSnap.exists()) continue;

      const ejData = ejSnap.data();
      const currentLinked: Array<{ documentoId: string; tipoDocumento: string }> =
        ejData._linkedDocumentos ?? [];

      const updatedLinked = currentLinked.filter((l) => l.documentoId !== documentoId);
      const estado = derivarEstadoComprobantes(updatedLinked);

      transaction.update(ejRef, {
        _linkedDocumentos: updatedLinked,
        _estadoComprobantes: estado.estado,
      });
    }

    // 4. For each KEPT ejecucionId (update if metadata changed)
    for (const ejId of diff.kept) {
      const ejRef = doc(db, `companies/${companyId}/ejecuciones`, ejId);
      const ejSnap = await transaction.get(ejRef);
      if (!ejSnap.exists()) continue;

      const ejData = ejSnap.data();
      const currentLinked: Array<{ documentoId: string; tipoDocumento: string; periodo?: string; montoTotal?: number; proveedorTexto?: string }> =
        ejData._linkedDocumentos ?? [];

      const updatedLinked = currentLinked.map((l) =>
        l.documentoId === documentoId
          ? {
              ...l,
              tipoDocumento: data.tipoDocumento,
              periodo: data.periodo,
              montoTotal: data.metadata?.montoTotal,
              proveedorTexto: data.metadata?.proveedorTexto,
            }
          : l,
      );
      const estado = derivarEstadoComprobantes(updatedLinked);

      transaction.update(ejRef, {
        _linkedDocumentos: updatedLinked,
        _estadoComprobantes: estado.estado,
      });
    }

    // 5. Update the DocumentoMedio itself
    const updateFields: Record<string, unknown> = {
      status: 'enlazado',
      tipoDocumento: data.tipoDocumento,
      periodo: data.periodo,
      terceroId: data.terceroId,
      ejecucionIds: data.ejecucionIds,
      updatedAt: new Date().toISOString(),
    };
    if (data.projectId) updateFields.projectId = data.projectId;
    if (data.metadata) updateFields.metadata = data.metadata;

    transaction.update(documentoRef, updateFields);
  });
}

/**
 * Unlink a DocumentoMedio from a single ejecucion.
 *
 * Uses runTransaction to:
 * 1. Remove ejecucionId from DocumentoMedio.ejecucionIds
 * 2. If ejecucionIds becomes empty → revert status to 'por_clasificar'
 * 3. Remove documento entry from Ejecucion._linkedDocumentos
 * 4. Recompute _estadoComprobantes on the ejecucion
 */
export async function unlinkDocumentoFromEjecucion(
  companyId: string,
  documentoId: string,
  ejecucionId: string,
): Promise<void> {
  const documentoRef = doc(db, `companies/${companyId}/documentos`, documentoId);
  const ejecucionRef = doc(db, `companies/${companyId}/ejecuciones`, ejecucionId);

  await runTransaction(db, async (transaction) => {
    // 1. Read the DocumentoMedio
    const docSnap = await transaction.get(documentoRef);
    if (!docSnap.exists()) return;

    const docData = docSnap.data();
    const currentEjecucionIds: string[] = docData.ejecucionIds ?? [];
    const updatedEjecucionIds = currentEjecucionIds.filter((id) => id !== ejecucionId);

    // 2. Update DocumentoMedio
    const docUpdate: Record<string, unknown> = {
      ejecucionIds: updatedEjecucionIds,
      updatedAt: new Date().toISOString(),
    };
    if (updatedEjecucionIds.length === 0) {
      docUpdate.status = 'por_clasificar';
    }
    transaction.update(documentoRef, docUpdate);

    // 3. Read and update Ejecucion
    const ejSnap = await transaction.get(ejecucionRef);
    if (!ejSnap.exists()) return;

    const ejData = ejSnap.data();
    const currentLinked: Array<{ documentoId: string; tipoDocumento: string }> =
      ejData._linkedDocumentos ?? [];
    const updatedLinked = currentLinked.filter((l) => l.documentoId !== documentoId);
    const estado = derivarEstadoComprobantes(updatedLinked);

    transaction.update(ejecucionRef, {
      _linkedDocumentos: updatedLinked,
      _estadoComprobantes: estado.estado,
    });
  });
}

/**
 * Atomically delete a DocumentoMedio from both Storage and Firestore.
 *
 * 1. Uses runTransaction to read the documento and update linked ejecuciones
 * 2. Deletes the Storage file
 * 3. Deletes the Firestore document
 */
export async function deleteDocumentoComplete(
  companyId: string,
  documentoId: string,
  storagePath: string,
): Promise<void> {
  const documentoRef = doc(db, `companies/${companyId}/documentos`, documentoId);

  // First, unlink from all linked ejecuciones
  const docSnap = await getDoc(documentoRef);
  if (!docSnap.exists()) return;

  const docData = docSnap.data();
  const linkedEjecucionIds: string[] = docData.ejecucionIds ?? [];

  // Unlink each ejecucion
  if (linkedEjecucionIds.length > 0) {
    await runTransaction(db, async (transaction) => {
      for (const ejId of linkedEjecucionIds) {
        const ejRef = doc(db, `companies/${companyId}/ejecuciones`, ejId);
        const ejSnap = await transaction.get(ejRef);
        if (!ejSnap.exists()) continue;

        const ejData = ejSnap.data();
        const currentLinked: Array<{ documentoId: string; tipoDocumento: string }> =
          ejData._linkedDocumentos ?? [];
        const updatedLinked = currentLinked.filter((l) => l.documentoId !== documentoId);
        const estado = derivarEstadoComprobantes(updatedLinked);

        transaction.update(ejRef, {
          _linkedDocumentos: updatedLinked,
          _estadoComprobantes: estado.estado,
        });
      }

      // Delete the documento from Firestore
      transaction.delete(documentoRef);
    });
  } else {
    // No linked ejecuciones — just delete
    await updateDoc(documentoRef, { status: 'por_clasificar' });
    // Use writeBatch for simple delete
    const batch = writeBatch(db);
    batch.delete(documentoRef);
    await batch.commit();
  }

  // Delete the Storage file
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch {
    // File may already be deleted — ignore
  }
}
