import { z } from 'zod';

const yyyymmRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const yyyymmddRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const documentoStatusValues = ['por_clasificar', 'enlazado'] as const;
const tipoDocumentoMedioValues = [
  'factura_venta', 'factura_compra', 'extracto_bancario',
  'comprobante_egreso', 'comprobante_ingreso',
  'planilla', 'contrato', 'otro',
] as const;
const documentSourceValues = ['inbox-upload', 'ejecucion-form', 'migration'] as const;

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
  _estadoComprobantes: z.enum(['Completada', 'Falta un comprobante', 'Sin comprobantes', '']).optional(),
});

export const documentoMedioSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  url: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string().min(1),
  status: z.enum(documentoStatusValues),
  tipoDocumento: z.enum(tipoDocumentoMedioValues).optional(),
  periodo: yearMonthSchema.optional(),
  terceroId: z.string().optional(),
  projectId: z.string().optional(),
  ejecucionIds: z.array(z.string()),
  metadata: z.object({
    proveedorTexto: z.string().optional(),
    nit: z.string().optional(),
    fechaDocumento: dateStringSchema.optional(),
    montoTotal: z.number().optional(),
  }).optional(),
  _source: z.enum(documentSourceValues),
  uploadedAt: z.string(),
  updatedAt: z.string().optional(),
  createdBy: z.string(),
});

export const partialBudgetSchema = budgetSchema.partial();
export const partialEjecucionSchema = ejecucionSchema.partial();
export const partialDocumentoMedioSchema = documentoMedioSchema.partial();
