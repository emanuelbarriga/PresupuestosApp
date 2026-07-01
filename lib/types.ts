export type TransactionType = 'ingreso' | 'egreso';
export type ProjectState = 'Activo' | 'Cerrado' | 'Negociación';
export type Month = 'Enero' | 'Febrero' | 'Marzo' | 'Abril' | 'Mayo' | 'Junio' | 'Julio' | 'Agosto' | 'Septiembre' | 'Octubre' | 'Noviembre' | 'Diciembre';

export const MONTHS: Month[] = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface Execution {
  fechaEjecutado: string;
  montoEjecutado: number;
}

export interface Transaction {
  id: string;
  descripcion: string;
  proyectoAsignado: string;
  clienteOProveedor: string;
  tipo: TransactionType;
  montoPresupuestado: number;
  mesPresupuestado: Month;
  estadoProyecto: ProjectState;
  ejecuciones: Execution[];
}

export type ViewType = 'Dashboard' | 'Proyectos' | 'Proveedores' | 'Clientes' | 'Datos';

export interface SidepanelData {
  title: string;
  subtitle: string;
  formula: string;
  transactions: Transaction[];
  value: number;
  presupuestado: number;
  ejecutado: number;
  diferencia: number;
  mode: 'Presupuestado' | 'Ejecutado';
  tipo: TransactionType;
  context?: {
    proyecto: string;
    mes: Month;
    cliente: string;
  };
}
