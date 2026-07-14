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
  archivado?: boolean;
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
  soloIngresos?: boolean;     // Si true, solo aparece en INGRESOS del Dashboard
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
  _movimientoId?: string;
  _extractoId?: string;
}

type AccountType = 'Ahorros' | 'Corriente' | 'Tarjeta de Crédito' | 'Caja Menor / Efectivo';
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
  /** Por qué falló la reconciliación (solo en memoria, no se persiste a Firestore) */
  revisionMotivo?: string;
  posibleDuplicado?: boolean;
  /** Marca si este movimiento ya fue convertido a ejecución */
  convertido?: boolean;
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
  predeterminada?: boolean;
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
  email: string;       // invited user's email
  status: 'pendiente' | 'aceptada';
  invitedBy: string;   // UID of admin who invited
  createdAt: string;
  expiresAt?: string;        // 7 days from creation
  acceptedAt?: string;       // when accepted
  acceptedBy?: string;       // who accepted
}

export type ViewType = 'Dashboard' | 'Proyectos' | 'Proveedores' | 'Clientes' | 'Datos' | 'Extractos' | 'Configuración' | 'EstadoResultados' | 'Media';

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
  | { type: 'cuenta'; cuenta: CuentaBancaria }
  | { type: 'extracto'; extracto: ExtractoBancario }
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

export type FormType = 'budget' | 'ejecucion' | 'project' | 'client' | 'provider' | 'tercero' | 'cuenta' | 'extracto' | 'invite-user' | 'edit-user-role' | 'create-company' | 'er-config';

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

// ─── ER (Estado de Resultados) Config types ────────────────────────────────────

export type ErTaxRegime = 'simple' | 'comun';

export interface ErLineConfig {
  projectIds: string[];
}

export interface ErConfig {
  id?: string;
  taxRegime: ErTaxRegime;
  lineItems: {
    ingresos: ErLineConfig;
    otrosIngresos: ErLineConfig;
    costos: ErLineConfig;
    gastosAdmin: ErLineConfig;
    gastosFinancieros: ErLineConfig;
  };
  createdAt?: Timestamp;
  updatedAt?: string;
}

// ─── Entity types (sidepanel entity unification) ──────────────────────────────

export type EntityType =
  | 'budget' | 'ejecucion' | 'project' | 'tercero'
  | 'cuenta' | 'extracto' | 'movimiento' | 'convertir-movimientos'
  | 'settings' | 'invitacion' | 'colaborador' | 'compania'
  | 'er-config';

// NavScreen — entity+mode replaces data/view/form dispatch.
// Entity-list variant carries dashboard cell click data for EntityList rendering.
// View/detalle-tercero variant is the only legacy carryover (not replaced by entity components).
export type NavScreen =
  | { type: 'entity'; entity: EntityType; mode: 'create' | 'edit' | 'view'; record?: any; defaults?: Record<string, string>; year?: number; filterTipo?: TransactionType; filterMode?: 'Presupuestado' | 'Ejecutado' }
  | { type: 'entity-list'; data: SidepanelData }
  | { type: 'customize'; id?: string }
  | { id: string; type: 'view'; detail: { type: 'detalle-tercero'; projects: Array<{ projectId: string; projectName: string; groups: DetalleTerceroGroup[]; totalPresupuestado: number; totalEjecutado: number; diferencia: number }>; totalPresupuestado: number; totalEjecutado: number; diferencia: number } }
  | { type: 'bulk-edit-tercero'; selectedIds: string[] }
  | { type: 'bulk-edit-presupuesto'; selectedIds: string[] }
  | { type: 'bulk-edit-ejecucion'; selectedIds: string[] };

// Entity component props contract
export interface EntityProps {
  mode: 'create' | 'edit' | 'view';
  companyId: string;
  record?: any;
  defaults?: Record<string, string>;
  year?: number;
  filterTipo?: TransactionType;
  filterMode?: 'Presupuestado' | 'Ejecutado';
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => Promise<void>;
  onNavigate: (screen: NavScreen) => void;
  onClose: () => void;
  onBack: () => void;
  canGoBack: boolean;
}
