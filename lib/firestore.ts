import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Company, Client, Project, Provider, Budget, Ejecucion, StateProject } from './types';

const COMPANIES_COLLECTION = 'companies';
const BUDGETS_COLLECTION = 'budgets';
const EJECUCIONES_COLLECTION = 'ejecuciones';
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';
const PROVIDERS_COLLECTION = 'providers';
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
    collection(db, CLIENTS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Client));
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
    collection(db, PROVIDERS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Provider));
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

export function subscribeBudgets(
  companyId: string,
  onData: (budgets: Budget[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, BUDGETS_COLLECTION),
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Budget));
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
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Ejecucion));
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
    collection(db, CLIENTS_COLLECTION),
    { ...client, createdAt: serverTimestamp() },
  );
  return docRef.id;
}

export async function addProvider(
  provider: Omit<Provider, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, PROVIDERS_COLLECTION),
    { ...provider, createdAt: serverTimestamp() },
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
  await updateDoc(doc(db, CLIENTS_COLLECTION, clientId), { ...data, updatedAt: serverTimestamp() });
}

export async function updateProvider(
  providerId: string,
  data: Partial<Provider>,
): Promise<void> {
  await updateDoc(doc(db, PROVIDERS_COLLECTION, providerId), { ...data, updatedAt: serverTimestamp() });
}
