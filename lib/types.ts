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
  budgetId?: string;
  comprobantes: Comprobante[];
  archivado?: boolean;
}

export type ViewType = 'Dashboard' | 'Proyectos' | 'Proveedores' | 'Clientes' | 'Datos' | 'Extractos' | 'Configuración';

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

export type FormType = 'budget' | 'ejecucion' | 'project' | 'client' | 'provider' | 'tercero';

export type ActiveForm =
  | { mode: 'add'; type: FormType; defaults?: Record<string, string> }
  | { mode: 'edit'; type: 'budget'; record: Budget }
  | { mode: 'edit'; type: 'ejecucion'; record: Ejecucion }
  | { mode: 'edit'; type: 'project'; record: Project }
  | { mode: 'edit'; type: 'client'; record: Client }
  | { mode: 'edit'; type: 'provider'; record: Provider }
  | { mode: 'edit'; type: 'tercero'; record: Tercero };

export type NavScreen =
  | { id: string; type: 'data'; data: SidepanelData }
  | { id: string; type: 'view'; detail: RecordDetail }
  | { id: string; type: 'form'; form: ActiveForm };
