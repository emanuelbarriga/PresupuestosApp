import type { Timestamp } from 'firebase/firestore';

export type TransactionType = 'ingreso' | 'egreso';
export type ProjectState = 'Activo' | 'Cerrado' | 'Negociación' | 'En ejecución' | 'Cancelado';

export interface SettingsItem {
  name: string;
  color: string;
  order: number;
}

export interface SettingsCategorias {
  stateProject: SettingsItem[];
  tipoProyectos: SettingsItem[];
  unidades: SettingsItem[];
  tipoComprobante: SettingsItem[];
  updatedAt?: string;
}

export interface StateProject {
  id: string;
  name: string;
}
export type Month = 'Enero' | 'Febrero' | 'Marzo' | 'Abril' | 'Mayo' | 'Junio' | 'Julio' | 'Agosto' | 'Septiembre' | 'Octubre' | 'Noviembre' | 'Diciembre';

export interface Company {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface Provider {
  id: string;
  name: string;
}

export interface Comprobante {
  id: string;
  name: string;
  url: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: string;
  descripcion?: string;
  tipo?: string;
}

/** Unified third-party — stores clients AND providers in /terceros collection */
export interface Tercero {
  id: string;
  name: string;
  apodo?: string;
  naturaleza?: 'Persona Natural' | 'Persona Jurídica';
  documento?: string;
  numeroDocumento?: string;
  lugar?: string;
  tipo: 'cliente' | 'proveedor' | 'ambos';
}

export interface Project {
  id: string;
  name: string;              // Sigla (e.g., "DDTL")
  descripcion?: string;       // Nombre completo (e.g., "Detrás del Telón")
  tipoProyectos?: string;     // Coincide con settings/categorias.tipoProyectos
  cantidad?: number;
  unidades?: string;          // Coincide con settings/categorias.unidades
  clientId: string;
  clientName: string;
  estado: string;
  soloEgresos?: boolean;      // Si true, solo aparece en EGRESOS del Dashboard
  orden?: number;             // Orden manual definido por el usuario (menor primero)
}

export const MONTHS: Month[] = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface DetalleTerceroGroup {
  entityId: string;
  entityName: string;
  entityType: 'client' | 'provider' | 'interno' | '';
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  totalPresupuestado: number;
  totalEjecutado: number;
  diferencia: number;
}

export interface Budget {
  id: string;
  descripcion: string;
  projectId: string;
  projectName: string;
  entityId: string;
  entityName: string;
  entityType: 'client' | 'provider' | 'interno' | '';
  tipo: TransactionType;
  montoPresupuestado: number;
  mesPresupuestado: Month;
  fechaPresupuestado: string;
  estadoProyecto: ProjectState;
  archivado?: boolean;
  /** Denormalized — sum of budgetLinks monto for this budget. Updated atomically on write. */
  totalEjecutado?: number;
  /** Denormalized — linked ejecucion IDs. Updated atomically via arrayUnion/arrayRemove. */
  linkedEjecuciones?: Array<{ ejecucionId: string; monto: number }>;
}

export interface EjecucionBudgetLink {
  id: string;
  companyId: string;
  budgetId: string;
  monto: number;
  createdAt?: Timestamp;
}

export interface Ejecucion {
  id: string;
  descripcion: string;
  projectId: string;
  projectName: string;
  entityId: string;
  entityName: string;
  entityType: 'client' | 'provider' | 'interno' | '';
  tipo: TransactionType;
  montoEjecutado: number;
  fechaEjecutado: string;
  cuentaId?: string;
  cuentaName?: string;
  comprobantes: Comprobante[];
  archivado?: boolean;
}

export type AccountType = 'Ahorros' | 'Corriente' | 'Tarjeta de Crédito' | 'Caja Menor / Efectivo';
export type Banco = 'Bancolombia' | 'Bancoomeva' | 'Global66' | 'No detectado';

export interface MovimientoBancarioInput {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  referencia?: string;
  debito?: number;
  credito?: number;
  saldo: number;
  moneda: string;
  ordinal: number;
  bancoOrigen: Banco;
  horaOriginal?: string; // solo Global66
  requiereRevision?: boolean;
  posibleDuplicado?: boolean;
}

export interface MovimientoBancario extends MovimientoBancarioInput {
  id: string;
  createdAt: Timestamp;
}

export type ExtractoEstado = 'Pendiente' | 'En revisión' | 'Conciliado' | 'Parseando' | 'Completado' | 'Error de parseo';

export interface CuentaBancaria {
  id: string;
  nombre: string;
  banco: string;
  tipo: AccountType;
  numero: string;
  moneda: string;
  saldoInicial: number;
  saldoActual: number;
}

export interface ExtractoBancario {
  id: string;
  accountId: string;
  mes: Month;
  anio: number;
  saldoInicial: number;
  saldoFinal: number;
  archivo?: { url: string; name: string; uploadedAt: string; path?: string };
  estado: ExtractoEstado;
  uploadedAt: string;
  totalMovimientosParseados?: number;
  errorParseo?: string;
}

export type UserRole = 'admin' | 'colaborador';

/** Perfil global del usuario — agnóstico a la empresa */
export interface UserProfile {
  id: string;          // Firebase Auth UID
  email: string;
  displayName?: string;
  createdAt: string;
}

/** Membresía del usuario dentro de una empresa específica */
export interface CompanyMember {
  id: string;          // Firebase Auth UID
  email: string;
  role: UserRole;
  joinedAt: string;
  blocked?: boolean;
}

export interface Invitacion {
  id?: string;         // Firestore doc ID
  companyId: string;
  companyName: string;
  email: string;       // invited user's email
  role: UserRole;
  status: 'pendiente' | 'aceptada';
  invitedBy: string;   // UID of admin who invited
  createdAt: string;
  expiresAt?: string;        // NEW — 7 days from creation
  acceptedAt?: string;       // NEW — when accepted
  acceptedBy?: string;       // NEW — who accepted
}

export type ViewType = 'Dashboard' | 'Proyectos' | 'Proveedores' | 'Clientes' | 'Datos' | 'Extractos' | 'Configuración' | 'EstadoResultados';

export interface SidepanelData {
  title: string;
  subtitle: string;
  formula: string;
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  value: number;
  presupuestado: number;
  ejecutado: number;
  diferencia: number;
  mode: 'Presupuestado' | 'Ejecutado';
  tipo: TransactionType;
}

export type RecordDetail =
  | { type: 'budget'; budget: Budget; ejecuciones: Ejecucion[] }
  | { type: 'ejecucion'; ejecucion: Ejecucion }
  | { type: 'project'; project: Project; budgets: Budget[]; ejecuciones: Ejecucion[] }
  | { type: 'client'; client: Client; projects: Project[] }
  | { type: 'provider'; provider: Provider }
  | { type: 'tercero'; tercero: Tercero }
  | { type: 'settings-editor'; category: string; title: string; items: any[] }
  | {
      type: 'detalle-tercero';
      projects: Array<{
        projectId: string;
        projectName: string;
        groups: DetalleTerceroGroup[];
        totalPresupuestado: number;
        totalEjecutado: number;
        diferencia: number;
      }>;
      totalPresupuestado: number;
      totalEjecutado: number;
      diferencia: number;
    };

export type FormType = 'budget' | 'ejecucion' | 'project' | 'client' | 'provider' | 'tercero' | 'cuenta' | 'extracto' | 'invite-user' | 'edit-user-role' | 'create-company';

export type ActiveForm =
  | { mode: 'add'; type: FormType; defaults?: Record<string, string> }
  | { mode: 'edit'; type: 'budget'; record: Budget }
  | { mode: 'edit'; type: 'ejecucion'; record: Ejecucion }
  | { mode: 'edit'; type: 'project'; record: Project }
  | { mode: 'edit'; type: 'client'; record: Client }
  | { mode: 'edit'; type: 'provider'; record: Provider }
  | { mode: 'edit'; type: 'tercero'; record: Tercero }
  | { mode: 'edit'; type: 'cuenta'; record: CuentaBancaria }
  | { mode: 'edit'; type: 'extracto'; record: ExtractoBancario }
  | { mode: 'edit'; type: 'invite-user'; record: Invitacion }
  | { mode: 'edit'; type: 'edit-user-role'; record: { userId: string; email: string; memberships: { companyId: string; companyName: string; role: string; blocked?: boolean }[] } };

export type NavScreen =
  | { id: string; type: 'data'; data: SidepanelData }
  | { id: string; type: 'view'; detail: RecordDetail }
  | { id: string; type: 'form'; form: ActiveForm }
  | { id: string; type: 'customize' };
