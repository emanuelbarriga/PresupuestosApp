import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Company, Client, Project, Provider, Budget, Ejecucion, StateProject, Tercero, SettingsCategorias } from './types';

const COMPANIES_COLLECTION = 'companies';
const BUDGETS_COLLECTION = 'budgets';
const EJECUCIONES_COLLECTION = 'ejecuciones';
const TERCEROS_COLLECTION = 'terceros';
const PROJECTS_COLLECTION = 'projects';
const STATE_PROJECTS_COLLECTION = 'stateProject';

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

export function subscribeStateProjects(
  onData: (states: StateProject[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, STATE_PROJECTS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as StateProject));
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
        } as Budget;
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
          budgetId: data.budgetId ?? undefined,
          comprobantes: Array.isArray(data.comprobantes) ? data.comprobantes : [],
          archivado: data.archivado ?? false,
        } as Ejecucion;
      }));
    },
    onError,
  );
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
