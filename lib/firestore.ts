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
import { Company, Client, Project, Provider, Budget, Ejecucion, EjecucionBudgetLink, StateProject, Tercero, SettingsCategorias, CuentaBancaria, ExtractoBancario, CompanyMember, Invitacion } from './types';

const COMPANIES_COLLECTION = 'companies';
const BUDGETS_COLLECTION = 'budgets';
const EJECUCIONES_COLLECTION = 'ejecuciones';
const BUDGET_LINKS_COLLECTION = 'budgetLinks';
const TERCEROS_COLLECTION = 'terceros';
const PROJECTS_COLLECTION = 'projects';
const STATE_PROJECTS_COLLECTION = 'stateProject';
const CUENTAS_BANCARIAS_COLLECTION = 'cuentasBancarias';
const EXTRACTOS_COLLECTION = 'extractos';
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
        const linkedIds = new Set(linked.map(l => l.ejecucionId));
        const ejecucionesSnap = await getDocs(collection(db, COMPANIES_COLLECTION, companyId, EJECUCIONES_COLLECTION));
        const filtered = ejecucionesSnap.docs
          .filter((d) => linkedIds.has(d.id))
          .map((d) => {
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
          });
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
  onData: (extractos: ExtractoBancario[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COMPANIES_COLLECTION, companyId, EXTRACTOS_COLLECTION),
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
  data: Omit<ExtractoBancario, 'id'>,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COMPANIES_COLLECTION, companyId, EXTRACTOS_COLLECTION),
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

export async function updateExtracto(
  companyId: string,
  extractoId: string,
  data: Partial<ExtractoBancario>,
): Promise<void> {
  await updateDoc(doc(db, COMPANIES_COLLECTION, companyId, EXTRACTOS_COLLECTION, extractoId), { ...data, updatedAt: serverTimestamp() });
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
        const companiesSnap = await getDocs(collection(db, COMPANIES_COLLECTION));
        const companies = companiesSnap.docs
          .filter((d) => companyIds.includes(d.id))
          .map((d) => ({ id: d.id, ...d.data() }) as Company);
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

  const companiesSnap = await getDocs(collection(db, COMPANIES_COLLECTION));
  return companiesSnap.docs
    .filter((d) => companyIds.includes(d.id))
    .map((d) => ({ id: d.id, ...d.data() }) as Company);
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

export function subscribeCompanyInvitations(
  companyId: string,
  onData: (invitations: Invitacion[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where('companyId', '==', companyId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitacion));
    },
    onError,
  );
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
