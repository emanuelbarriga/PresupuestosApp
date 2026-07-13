import { z } from 'zod';

const yyyymmRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const yyyymmddRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const yearMonthSchema = z.string().regex(yyyymmRegex, 'fechaPresupuestado debe tener formato YYYY-MM con mes válido');
export const dateStringSchema = z.string().regex(yyyymmddRegex, 'fechaEjecutado debe tener formato YYYY-MM-DD con fecha válida');

const monthValues = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] as const;

export const budgetSchema = z.object({
  descripcion: z.string().min(1, 'descripcion es requerida'),
  projectId: z.string(),
  projectName: z.string(),
  entityId: z.string(),
  entityName: z.string(),
  entityType: z.enum(['client', 'provider', 'interno', '']),
  tipo: z.enum(['ingreso', 'egreso']),
  montoPresupuestado: z.number(),
  mesPresupuestado: z.enum(monthValues),
  fechaPresupuestado: yearMonthSchema,
  estadoProyecto: z.string(),
  archivado: z.boolean().optional(),
  totalEjecutado: z.number().optional(),
  linkedEjecuciones: z.array(z.object({ ejecucionId: z.string(), monto: z.number() })).optional(),
});

export const ejecucionSchema = z.object({
  descripcion: z.string().min(1, 'descripcion es requerida'),
  projectId: z.string(),
  projectName: z.string(),
  entityId: z.string(),
  entityName: z.string(),
  entityType: z.enum(['client', 'provider', 'interno', '']),
  tipo: z.enum(['ingreso', 'egreso']),
  montoEjecutado: z.number(),
  fechaEjecutado: dateStringSchema,
  cuentaId: z.string().optional(),
  cuentaName: z.string().optional(),
  comprobantes: z.array(z.any()).optional(),
  archivado: z.boolean().optional(),
  _movimientoId: z.string().optional(),
  _extractoId: z.string().optional(),
});

export const partialBudgetSchema = budgetSchema.partial();
export const partialEjecucionSchema = ejecucionSchema.partial();
