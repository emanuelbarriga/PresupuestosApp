import {
  collection,
  collectionGroup,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  documentId,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Company, Client, Project, Provider, Budget, Ejecucion, EjecucionBudgetLink, StateProject, Tercero, SettingsCategorias, CuentaBancaria, ExtractoBancario, ExtractoEstado, CompanyMember, Invitacion, MovimientoBancarioInput, MovimientoBancario } from './types';

const COMPANIES_COLLECTION = 'companies';
const BUDGETS_COLLECTION = 'budgets';
const EJECUCIONES_COLLECTION = 'ejecuciones';
const BUDGET_LINKS_COLLECTION = 'budgetLinks';
const TERCEROS_COLLECTION = 'terceros';
const PROJECTS_COLLECTION = 'projects';
const STATE_PROJECTS_COLLECTION = 'stateProject';
const CUENTAS_BANCARIAS_COLLECTION = 'cuentasBancarias';
const EXTRACTOS_COLLECTION = 'extractos';
const MOVIMIENTOS_COLLECTION = 'movimientos';
const INVITATIONS_COLLECTION = 'invitations';

export async function getCompanies(): Promise<Company[]> {
  const snapshot = await getDocs(collection(db, COMPANIES_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Company);
}

export function subscribeCompanies(
  onData: (companies: Company[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Company));
    },
    onError,
  );
}

export function subscribeClients(
  onData: (clients: Client[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, TERCEROS_COLLECTION), where('tipo', 'in', ['cliente', 'ambos'])),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' }) as Client));
    },
    onError,
  );
}

export function subscribeProjects(
  companyId: string,
  onData: (projects: Project[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, PROJECTS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Project));
    },
    onError,
  );
}

export function subscribeProviders(
  onData: (providers: Provider[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, TERCEROS_COLLECTION), where('tipo', 'in', ['proveedor', 'ambos'])),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' }) as Provider));
    },
    onError,
  );
}

export function subscribeTerceros(
  onData: (terceros: Tercero[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, TERCEROS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Tercero));
    },
    onError,
  );
}

export function subscribeSettings(
  onData: (data: SettingsCategorias) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'categorias'),
    (snapshot) => {
      const d = snapshot.data();
      if (d) {
        const normalize = (items: any) => {
          if (!items) return [];
          if (typeof items[0] === 'string') return items.map((name: string, i: number) => ({ name, color: '#6366f1', order: i }));
          return items;
        };
        onData({
          stateProject: normalize(d.stateProject) ?? [],
          tipoProyectos: normalize(d.tipoProyectos) ?? [],
          unidades: normalize(d.unidades) ?? [],
          tipoComprobante: normalize(d.tipoComprobante) ?? [],
          updatedAt: d.updatedAt,
        } as SettingsCategorias);
      }
    },
    onError,
  );
}

export async function updateSettings(data: Partial<SettingsCategorias>): Promise<void> {
  await updateDoc(doc(db, 'settings', 'categorias'), { ...data, updatedAt: serverTimestamp() });
}

export function subscribeCompanySettings(
  companyId: string,
  onData: (data: SettingsCategorias) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COMPANIES_COLLECTION, companyId, 'settings', 'categorias'),
    (snapshot) => {
      const d = snapshot.data();
      if (d) {
        const normalize = (items: any) => {
          if (!items) return [];
          if (typeof items[0] === 'string') return items.map((name: string, i: number) => ({ name, color: '#6366f1', order: i }));
          return items;
        };
        onData({
          stateProject: normalize(d.stateProject) ?? [],
          tipoProyectos: normalize(d.tipoProyectos) ?? [],
          unidades: normalize(d.unidades) ?? [],
          tipoComprobante: normalize(d.tipoComprobante) ?? [],
          updatedAt: d.updatedAt,
        } as SettingsCategorias);
      }
    },
    onError,
  );
}

function subscribeBudgetsWithFilter(
  companyId: string,
  archivedFilter: boolean,
  onData: (budgets: Budget[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COMPANIES_COLLECTION, companyId, BUDGETS_COLLECTION),
      where('archivado', '==', archivedFilter),
    ),
    (snapshot) => {
      onData(snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          descripcion: data.descripcion ?? '',
          projectId: data.projectId ?? '',
          projectName: data.projectName ?? data.proyectoAsignado ?? '',
          entityId: data.entityId ?? '',
          entityName: data.entityName ?? data.clienteOProveedor ?? '',
          entityType: data.entityType ?? '',
          tipo: data.tipo ?? 'ingreso',
          montoPresupuestado: data.montoPresupuestado ?? 0,
          mesPresupuestado: data.mesPresupuestado ?? 'Enero',
          fechaPresupuestado: data.fechaPresupuestado ?? '',
          estadoProyecto: data.estadoProyecto ?? 'Activo',
          archivado: data.archivado ?? false,
          totalEjecutado: data.totalEjecutado ?? undefined,
          linkedEjecuciones: Array.isArray(data.linkedEjecuciones) ? data.linkedEjecuciones : undefined,
        } as Budget;
      }));
    },
    onError,
  );
}

export function subscribeBudgets(
  companyId: string,
  onData: (budgets: Budget[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, BUDGETS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          descripcion: data.descripcion ?? '',
          projectId: data.projectId ?? '',
          projectName: data.projectName ?? data.proyectoAsignado ?? '',
          entityId: data.entityId ?? '',
          entityName: data.entityName ?? data.clienteOProveedor ?? '',
          entityType: data.entityType ?? '',
          tipo: data.tipo ?? 'ingreso',
          montoPresupuestado: data.montoPresupuestado ?? 0,
          mesPresupuestado: data.mesPresupuestado ?? 'Enero',
          fechaPresupuestado: data.fechaPresupuestado ?? '',
          estadoProyecto: data.estadoProyecto ?? 'Activo',
          archivado: data.archivado ?? false,
          totalEjecutado: data.totalEjecutado ?? undefined,
          linkedEjecuciones: Array.isArray(data.linkedEjecuciones) ? data.linkedEjecuciones : undefined,
        } as Budget;
      }));
    },
    onError,
  );
}

export function subscribeArchivedBudgets(
  companyId: string,
  onData: (budgets: Budget[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeBudgetsWithFilter(companyId, true, onData, onError);
}

function subscribeEjecucionesWithFilter(
  companyId: string,
  archivedFilter: boolean,
  onData: (ejecuciones: Ejecucion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION),
      where('archivado', '==', archivedFilter),
    ),
    (snapshot) => {
      onData(snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          descripcion: data.descripcion ?? '',
          projectId: data.projectId ?? '',
          projectName: data.projectName ?? data.proyectoAsignado ?? '',
          entityId: data.entityId ?? '',
          entityName: data.entityName ?? data.clienteOProveedor ?? '',
          entityType: data.entityType ?? '',
          tipo: data.tipo ?? 'ingreso',
          montoEjecutado: data.montoEjecutado ?? 0,
          fechaEjecutado: data.fechaEjecutado ?? '',
          cuentaId: data.cuentaId ?? undefined,
          cuentaName: data.cuentaName ?? undefined,
          comprobantes: Array.isArray(data.comprobantes) ? data.comprobantes : [],
          archivado: data.archivado ?? false,
        } as Ejecucion;
      }));
    },
    onError,
  );
}

export function subscribeEjecuciones(
  companyId: string,
  onData: (ejecuciones: Ejecucion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          descripcion: data.descripcion ?? '',
          projectId: data.projectId ?? '',
          projectName: data.projectName ?? data.proyectoAsignado ?? '',
          entityId: data.entityId ?? '',
          entityName: data.entityName ?? data.clienteOProveedor ?? '',
          entityType: data.entityType ?? '',
          tipo: data.tipo ?? 'ingreso',
          montoEjecutado: data.montoEjecutado ?? 0,
          fechaEjecutado: data.fechaEjecutado ?? '',
          cuentaId: data.cuentaId ?? undefined,
          cuentaName: data.cuentaName ?? undefined,
          comprobantes: Array.isArray(data.comprobantes) ? data.comprobantes : [],
          archivado: data.archivado ?? false,
        } as Ejecucion;
      }));
    },
    onError,
  );
}

export function subscribeArchivedEjecuciones(
  companyId: string,
  onData: (ejecuciones: Ejecucion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeEjecucionesWithFilter(companyId, true, onData, onError);
}

export async function addBudget(
  companyId: string,
  budget: Omit<Budget, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, BUDGETS_COLLECTION),
    { ...budget, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addEjecucion(
  companyId: string,
  ejecucion: Omit<Ejecucion, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION),
    { ...ejecucion, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addClient(
  client: Omit<Client, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, TERCEROS_COLLECTION),
    { ...client, tipo: 'cliente', createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addProvider(
  provider: Omit<Provider, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, TERCEROS_COLLECTION),
    { ...provider, tipo: 'proveedor', createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addTercero(data: Record<string, any>): Promise<string> {
  const docRef = await addDoc(
    collection(db, TERCEROS_COLLECTION),
    { ...data, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addProject(companyId: string, project: Omit<Project, 'id'>): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, PROJECTS_COLLECTION),
    { ...project, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function updateBudget(companyId: string, budgetId: string, data: Partial<Budget>): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, BUDGETS_COLLECTION, budgetId), { ...data, updatedAt: serverTimestamp() });
}

export async function updateEjecucion(companyId: string, ejecucionId: string, data: Partial<Ejecucion>): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId), { ...data, updatedAt: serverTimestamp() });
}

export async function getEjecucion(companyId: string, ejecucionId: string): Promise<Ejecucion | null> {
  const snap = await getDoc(doc(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    descripcion: d.descripcion ?? '',
    projectId: d.projectId ?? '',
    projectName: d.projectName ?? '',
    entityId: d.entityId ?? '',
    entityName: d.entityName ?? '',
    entityType: d.entityType ?? '',
    tipo: d.tipo ?? 'ingreso',
    montoEjecutado: d.montoEjecutado ?? 0,
    fechaEjecutado: d.fechaEjecutado ?? '',
    cuentaId: d.cuentaId ?? undefined,
    cuentaName: d.cuentaName ?? undefined,
    comprobantes: Array.isArray(d.comprobantes) ? d.comprobantes : [],
  } as Ejecucion;
}

// ── Budget Links (N:M junction) ──

export function subscribeBudgetLinks(
  companyId: string,
  ejecucionId: string,
  onData: (links: EjecucionBudgetLink[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          companyId: data.companyId ?? '',
          budgetId: data.budgetId ?? '',
          monto: data.monto ?? 0,
          createdAt: data.createdAt ?? undefined,
        } as EjecucionBudgetLink;
      }));
    },
    onError,
  );
}

export async function addBudgetLink(
  companyId: string,
  ejecucionId: string,
  data: Omit<EjecucionBudgetLink, 'id' | 'createdAt'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION),
    { ...data, createdAt: serverTimestamp() },
  );
  // Denormalize on the budget: totalEjecutado + linkedEjecuciones
  await updateDoc(
    doc(db, COMPANIES_COLLECTION, companyId, 'budgets', data.budgetId),
    {
      totalEjecutado: increment(data.monto),
      linkedEjecuciones: arrayUnion({ ejecucionId, monto: data.monto }),
    },
  );
  return docRef.id;
}

export async function removeBudgetLink(
  companyId: string,
  ejecucionId: string,
  linkId: string,
): Promise<void> {
  // Read the link to get budgetId and monto before deleting
  const linkRef = doc(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION, linkId);
  const linkSnap = await getDoc(linkRef);
  const linkData = linkSnap.data() as EjecucionBudgetLink | undefined;
  await deleteDoc(linkRef);
  // Decrement denormalized data on the budget
  if (linkData?.budgetId && linkData?.monto) {
    await updateDoc(
      doc(db, COMPANIES_COLLECTION, companyId, 'budgets', linkData.budgetId),
      {
        totalEjecutado: increment(-linkData.monto),
        linkedEjecuciones: arrayRemove({ ejecucionId, monto: linkData.monto }),
      },
    );
  }
}

/**
 * Fetches documents by their IDs from a collection, handling Firestore's 30-element
 * limit on `in` queries by batching. Returns documents in request order preserving
 * the input `ids` sequence (documents not found are omitted).
 */
async function fetchDocsByIds<T>(
  collectionPath: string,
  ids: string[],
  mapper: (id: string, data: Record<string, unknown>) => T,
): Promise<T[]> {
  if (ids.length === 0) return [];

  const BATCH_SIZE = 30;
  const results: T[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const q = query(collection(db, collectionPath), where(documentId(), 'in', batch));
    const snap = await getDocs(q);
    const batchMap = new Map(snap.docs.map((d) => [d.id, d.data()]));

    // Preserve input order and skip missing docs
    for (const id of batch) {
      const data = batchMap.get(id);
      if (data) results.push(mapper(id, data));
    }
  }

  return results;
}

export function subscribeEjecucionesByBudget(
  companyId: string,
  budgetId: string,
  onData: (ejecuciones: Ejecucion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // Subscribe to the budget doc to read denormalized linkedEjecuciones (no collectionGroup needed)
  const budgetRef = doc(db, COMPANIES_COLLECTION, companyId, 'budgets', budgetId);
  return onSnapshot(
    budgetRef,
    async (snapshot) => {
      const data = snapshot.data();
      const linked = (data?.linkedEjecuciones as Array<{ ejecucionId: string; monto: number }>) ?? [];
      if (linked.length === 0) {
        onData([]);
        return;
      }
      try {
        const linkedIds = linked.map(l => l.ejecucionId);
        const ejecucionPath = `${COMPANIES_COLLECTION}/${companyId}/${EJECUCIONES_COLLECTION}`;
        const filtered = await fetchDocsByIds(ejecucionPath, linkedIds, (id, data) => ({
          id,
          descripcion: (data.descripcion as string) ?? '',
          projectId: (data.projectId as string) ?? '',
          projectName: (data.projectName as string) ?? (data.proyectoAsignado as string) ?? '',
          entityId: (data.entityId as string) ?? '',
          entityName: (data.entityName as string) ?? (data.clienteOProveedor as string) ?? '',
          entityType: (data.entityType as string) ?? '',
          tipo: (data.tipo as string) ?? 'ingreso',
          montoEjecutado: (data.montoEjecutado as number) ?? 0,
          fechaEjecutado: (data.fechaEjecutado as string) ?? '',
          cuentaId: (data.cuentaId as string | undefined) ?? undefined,
          cuentaName: (data.cuentaName as string | undefined) ?? undefined,
          comprobantes: Array.isArray(data.comprobantes) ? data.comprobantes : [],
          archivado: (data.archivado as boolean) ?? false,
        } as Ejecucion));
        onData(filtered);
      } catch (err) {
        onError?.(err as Error);
      }
    },
    onError,
  );
}

export async function updateProject(companyId: string, projectId: string, data: Partial<Project>): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, PROJECTS_COLLECTION, projectId), { ...data, updatedAt: serverTimestamp() });
}

export async function updateClient(
  clientId: string,
  data: Partial<Client>,
): Promise<void> {
  await updateDoc(doc(db, TERCEROS_COLLECTION, clientId), { ...data, updatedAt: serverTimestamp() });
}

export async function updateProvider(
  providerId: string,
  data: Partial<Provider>,
): Promise<void> {
  await updateDoc(doc(db, TERCEROS_COLLECTION, providerId), { ...data, updatedAt: serverTimestamp() });
}

export async function updateTercero(
  terceroId: string,
  data: Record<string, any>,
): Promise<void> {
  await updateDoc(doc(db, TERCEROS_COLLECTION, terceroId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTercero(terceroId: string): Promise<void> {
  await deleteDoc(doc(db, TERCEROS_COLLECTION, terceroId));
}

/**
 * Check if a tercero has asociada ejecuciones in a company.
 * Returns the count of ejecuciones referencing this entityId.
 */
export async function countEjecucionesByTercero(companyId: string, terceroId: string): Promise<number> {
  const q = query(
    collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION),
    where('entityId', '==', terceroId),
  );
  const snap = await getDocs(q);
  return snap.size;
}

// ── Cuentas Bancarias ──

export function subscribeCuentasBancarias(
  companyId: string,
  onData: (cuentas: CuentaBancaria[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CuentaBancaria));
    },
    onError,
  );
}

export function subscribeExtractos(
  companyId: string,
  accountId: string,
  onData: (extractos: ExtractoBancario[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ExtractoBancario));
    },
    onError,
  );
}

export async function addCuentaBancaria(
  companyId: string,
  data: Omit<CuentaBancaria, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION),
    { ...data, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addExtracto(
  companyId: string,
  accountId: string,
  data: Omit<ExtractoBancario, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION),
    { ...data, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function updateCuentaBancaria(
  companyId: string,
  cuentaId: string,
  data: Partial<CuentaBancaria>,
): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, cuentaId), { ...data, updatedAt: serverTimestamp() });
}

/**
 * Mark one bank account as default (predeterminada). Unsets any other default
 * in the same company atomically via a single batch write.
 */
export async function setCuentaPredeterminada(
  companyId: string,
  cuentaId: string,
): Promise<void> {
  const cuentasRef = collection(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION);
  const snapshot = await getDocs(cuentasRef);
  const batch = writeBatch(db);

  for (const docSnap of snapshot.docs) {
    const isTarget = docSnap.id === cuentaId;
    // Only write if the field needs to change
    const current = docSnap.data().predeterminada;
    if (current === isTarget) continue;
    batch.update(docSnap.ref, { predeterminada: isTarget, updatedAt: serverTimestamp() });
  }

  await batch.commit();
}

export async function updateExtracto(
  companyId: string,
  accountId: string,
  extractoId: string,
  data: Partial<ExtractoBancario>,
): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION, extractoId), { ...data, updatedAt: serverTimestamp() });
}

// ── Movimientos Bancarios (subcollection of extractos) ──

export function subscribeMovimientos(
  companyId: string,
  accountId: string,
  extractoId: string,
  onData: (movimientos: MovimientoBancario[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION, extractoId, MOVIMIENTOS_COLLECTION),
    (snapshot) => {
      const movs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MovimientoBancario);
      onData(movs);
    },
    (err) => {
      onError?.(err);
    },
  );
}

export async function batchAddMovimientos(
  companyId: string,
  accountId: string,
  extractoId: string,
  movimientos: MovimientoBancarioInput[],
): Promise<string[]> {
  if (movimientos.length > 500) {
    throw new Error('batchAddMovimientos: cannot write more than 500 documents in a single batch');
  }

  const batch = writeBatch(db);
  const ids: string[] = [];
  const movimientosRef = collection(
    db,
    COMPANIES_COLLECTION,
    companyId,
    CUENTAS_BANCARIAS_COLLECTION,
    accountId,
    EXTRACTOS_COLLECTION,
    extractoId,
    MOVIMIENTOS_COLLECTION,
  );

  for (const mov of movimientos) {
    const ref = doc(movimientosRef);
    // Firestore no acepta undefined — limpiar campos undefined antes de escribir
    const cleanMov = Object.fromEntries(
      Object.entries(mov).filter(([_, v]) => v !== undefined),
    );
    batch.set(ref, { ...cleanMov, createdAt: serverTimestamp() });
    ids.push(ref.id);
  }

  await batch.commit();
  return ids;
}

export async function deleteMovimiento(
  companyId: string,
  accountId: string,
  extractoId: string,
  movimientoId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION, extractoId, MOVIMIENTOS_COLLECTION, movimientoId),
  );
}

export async function updateMovimiento(
  companyId: string,
  accountId: string,
  extractoId: string,
  movimientoId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(
    doc(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION, extractoId, MOVIMIENTOS_COLLECTION, movimientoId),
    { ...data, updatedAt: serverTimestamp() },
  );
}

/**
 * Delete an extracto and ALL its movimientos (subcollection).
 * Uses batched writes to delete all movimientos first, then the extracto itself.
 */
export async function deleteExtracto(
  companyId: string,
  accountId: string,
  extractoId: string,
): Promise<void> {
  const extractoRef = doc(
    db, COMPANIES_COLLECTION, companyId,
    CUENTAS_BANCARIAS_COLLECTION, accountId,
    EXTRACTOS_COLLECTION, extractoId,
  );
  const movimientosRef = collection(extractoRef, MOVIMIENTOS_COLLECTION);

  // Fetch all movimiento IDs
  const snap = await getDocs(movimientosRef);
  const ids = snap.docs.map(d => d.id);

  // Delete in batches of 500 (Firestore limit)
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + 500);
      for (const movId of chunk) {
        batch.delete(doc(movimientosRef, movId));
      }
      await batch.commit();
    }
  }

  // Delete the extracto document itself
  await deleteDoc(extractoRef);
}

export async function updateExtractoStatus(
  companyId: string,
  accountId: string,
  extractoId: string,
  estado: ExtractoEstado,
  meta?: {
    totalMovimientosParseados?: number;
    errorParseo?: string;
    saldoInicial?: number;
    saldoFinal?: number;
  },
): Promise<void> {
  const data: Record<string, unknown> = { estado, updatedAt: serverTimestamp() };
  if (meta?.totalMovimientosParseados !== undefined) {
    data.totalMovimientosParseados = meta.totalMovimientosParseados;
  }
  if (meta?.errorParseo !== undefined) {
    data.errorParseo = meta.errorParseo;
  }
  // Saldos parsed from the PDF are the source of truth — overwrite any manual entry.
  if (meta?.saldoInicial !== undefined) {
    data.saldoInicial = meta.saldoInicial;
  }
  if (meta?.saldoFinal !== undefined) {
    data.saldoFinal = meta.saldoFinal;
  }
  await updateDoc(
    doc(db, COMPANIES_COLLECTION, companyId, CUENTAS_BANCARIAS_COLLECTION, accountId, EXTRACTOS_COLLECTION, extractoId),
    data,
  );
}

// ── User Companies (Membership) ──

export function subscribeUserCompanies(
  userId: string,
  onData: (companies: Company[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'members'),
    where('id', '==', userId),
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      // Filter out blocked members
      const activeDocs = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        return data.blocked !== true;
      });

      const companyIds = activeDocs.map((docSnap) => {
        const segments = docSnap.ref.path.split('/');
        return segments[1]; // companies/{companyId}/members/{userId}
      });

      if (companyIds.length === 0) {
        onData([]);
        return;
      }

      try {
        const companies = await fetchDocsByIds(COMPANIES_COLLECTION, companyIds, (id, data) => ({ id, ...data }) as Company);
        onData(companies);
      } catch (err) {
        onError?.(err as Error);
      }
    },
    onError,
  );
}

export async function getUserCompaniesSnapshot(userId: string): Promise<Company[]> {
  const q = query(
    collectionGroup(db, 'members'),
    where('id', '==', userId),
  );
  const snapshot = await getDocs(q);

  // Filter out blocked members
  const activeDocs = snapshot.docs.filter((docSnap) => {
    const data = docSnap.data();
    return data.blocked !== true;
  });

  const companyIds = activeDocs.map((docSnap) => {
    const segments = docSnap.ref.path.split('/');
    return segments[1];
  });

  if (companyIds.length === 0) return [];

  return fetchDocsByIds(COMPANIES_COLLECTION, companyIds, (id, data) => ({ id, ...data }) as Company);
}

export function subscribeCompanyMembers(
  companyId: string,
  onData: (members: CompanyMember[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, 'members'),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CompanyMember));
    },
    onError,
  );
}

// ── Invitations ──

export function subscribeInvitations(
  email: string,
  onData: (invitations: Invitacion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where('email', '==', email),
    where('status', '==', 'pendiente'),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitacion));
    },
    onError,
  );
}

export async function createInvitation(invitation: Omit<Invitacion, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, INVITATIONS_COLLECTION), invitation);
  return docRef.id;
}

/**
 * Subscribe to invitations created by a specific admin.
 * Replaces the old subscribeCompanyInvitations which relied on companyId.
 */
export function subscribeCreatedInvitations(
  adminUid: string,
  onData: (invitations: Invitacion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where('invitedBy', '==', adminUid),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitacion));
    },
    onError,
  );
}

/** @deprecated Invitations no longer have companyId. Use subscribeCreatedInvitations instead. */
export function subscribeCompanyInvitations(
  _companyId: string,
  _onData: (invitations: Invitacion[]) => void,
  _onError?: (err: Error) => void,
): Unsubscribe {
  // Return a no-op unsubscribe — this function no longer filters by company.
  console.warn('subscribeCompanyInvitations is deprecated. Use subscribeCreatedInvitations instead.');
  return () => {};
}

// ── Member Management ──

export async function deleteMemberFromCompany(companyId: string, memberId: string): Promise<void> {
  await deleteDoc(doc(db, COMPANIES_COLLECTION, companyId, 'members', memberId));
}

export async function blockMember(companyId: string, memberId: string, blocked: boolean): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, 'members', memberId), { blocked });
}

export async function deleteInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, INVITATIONS_COLLECTION, invitationId));
}

// ── Unassigned Users (pendingAssignment flag) ──

/**
 * Subscribe to users with pendingAssignment === true.
 * These are users who accepted an invitation but haven't been assigned to a company yet.
 */
export function subscribeUnassignedUsers(
  onData: (users: Array<{ id: string; email: string }>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'users'),
    where('pendingAssignment', '==', true),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => {
        const data = d.data();
        return { id: d.id, email: data.email ?? '' };
      }));
    },
    onError,
  );
}

/**
 * Assign a user to a company by creating the membership and clearing the pendingAssignment flag.
 * NOTE: This writes directly to Firestore. If you need this via API, use POST /api/companies/assign-user instead.
 */
export async function assignUserToCompany(
  userId: string,
  companyId: string,
  role: string,
  email?: string,
): Promise<void> {
  const batch = writeBatch(db);

  batch.set(
    doc(db, COMPANIES_COLLECTION, companyId, 'members', userId),
    {
      id: userId,
      email: email ?? '',
      role,
      joinedAt: new Date().toISOString(),
    },
  );

  batch.update(
    doc(db, 'users', userId),
    { pendingAssignment: false },
  );

  await batch.commit();
}

export async function updateInvitation(
  invitationId: string,
  data: { role?: string; expiresAt?: string },
): Promise<void> {
  await updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), data);
}

export async function updateMemberRole(
  companyId: string,
  memberId: string,
  role: string,
): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, 'members', memberId), { role });
}

export async function addMemberToCompany(
  companyId: string,
  memberId: string,
  email: string,
  role: string = 'colaborador',
): Promise<void> {
  await setDoc(doc(db, COMPANIES_COLLECTION, companyId, 'members', memberId), {
    id: memberId,
    email,
    role,
    joinedAt: new Date().toISOString(),
  });
}

// ── Budget Management ──

export async function deleteBudget(companyId: string, budgetId: string): Promise<void> {
  const budgetRef = doc(db, COMPANIES_COLLECTION, companyId, BUDGETS_COLLECTION, budgetId);
  const budgetSnap = await getDoc(budgetRef);
  if (!budgetSnap.exists()) return;

  const budget = budgetSnap.data() as Budget;
  const links = budget.linkedEjecuciones ?? [];

  // Clean up budgetLinks under each linked ejecucion
  for (const link of links) {
    const q = query(
      collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, link.ejecucionId, BUDGET_LINKS_COLLECTION),
      where('budgetId', '==', budgetId),
    );
    const linkSnap = await getDocs(q);
    for (const linkDoc of linkSnap.docs) {
      await deleteDoc(linkDoc.ref);
    }
  }

  await deleteDoc(budgetRef);
}

export async function deleteEjecucion(companyId: string, ejecucionId: string): Promise<void> {
  const ejecucionRef = doc(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId);
  const linksSnap = await getDocs(collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION, ejecucionId, BUDGET_LINKS_COLLECTION));
  const batch = writeBatch(db);
  linksSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(ejecucionRef);
  await batch.commit();
}
