export type TransactionType = 'ingreso' | 'egreso';
export type ProjectState = 'Activo' | 'Cerrado' | 'Negociación' | 'En ejecución' | 'Cancelado';

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

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  estado: string;
}

export interface Provider {
  id: string;
  name: string;
}

export const MONTHS: Month[] = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface Budget {
  id: string;
  descripcion: string;
  proyectoAsignado: string;
  clienteOProveedor: string;
  tipo: TransactionType;
  montoPresupuestado: number;
  mesPresupuestado: Month;
  fechaPresupuestado: string;
  estadoProyecto: ProjectState;
}

export interface Ejecucion {
  id: string;
  descripcion: string;
  proyectoAsignado: string;
  clienteOProveedor: string;
  tipo: TransactionType;
  montoEjecutado: number;
  fechaEjecutado: string;
  budgetId?: string;
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
  | { type: 'provider'; provider: Provider };

export type FormType = 'budget' | 'ejecucion' | 'project' | 'client' | 'provider';

export type ActiveForm =
  | { mode: 'add'; type: FormType; defaults?: Record<string, string> }
  | { mode: 'edit'; type: 'budget'; record: Budget }
  | { mode: 'edit'; type: 'ejecucion'; record: Ejecucion }
  | { mode: 'edit'; type: 'project'; record: Project }
  | { mode: 'edit'; type: 'client'; record: Client }
  | { mode: 'edit'; type: 'provider'; record: Provider };
