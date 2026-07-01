import { Transaction } from "./types";

export const mockTransactions: Transaction[] = [
  {
    id: "T-001",
    descripcion: "Anticipo Fase 1",
    proyectoAsignado: "DDTL",
    clienteOProveedor: "Borondo",
    tipo: "ingreso",
    montoPresupuestado: 50000000,
    mesPresupuestado: "Febrero",
    estadoProyecto: "Activo",
    ejecuciones: [
      { fechaEjecutado: "2026-02-15", montoEjecutado: 40000000 },
      { fechaEjecutado: "2026-02-28", montoEjecutado: 2955658 }
    ]
  },
  {
    id: "T-002",
    descripcion: "Pago Fase 2",
    proyectoAsignado: "DDTL",
    clienteOProveedor: "Borondo",
    tipo: "ingreso",
    montoPresupuestado: 45000000,
    mesPresupuestado: "Mayo",
    estadoProyecto: "Activo",
    ejecuciones: [
      { fechaEjecutado: "2026-05-10", montoEjecutado: 46658570 }
    ]
  },
  {
    id: "T-003",
    descripcion: "Costos Operativos Q1",
    proyectoAsignado: "Gastos Administrativos Samán",
    clienteOProveedor: "Interno",
    tipo: "egreso",
    montoPresupuestado: 20000000,
    mesPresupuestado: "Enero",
    estadoProyecto: "Activo",
    ejecuciones: [
      { fechaEjecutado: "2026-01-15", montoEjecutado: 10000000 },
      { fechaEjecutado: "2026-01-30", montoEjecutado: 10500000 }
    ]
  },
  {
    id: "T-004",
    descripcion: "Producción Audiovisual",
    proyectoAsignado: "Coordinación Pácora",
    clienteOProveedor: "Nonstop México",
    tipo: "ingreso",
    montoPresupuestado: 120000000,
    mesPresupuestado: "Marzo",
    estadoProyecto: "Cerrado",
    ejecuciones: [
      { fechaEjecutado: "2026-03-05", montoEjecutado: 60000000 },
      { fechaEjecutado: "2026-03-25", montoEjecutado: 60000000 }
    ]
  },
  {
    id: "T-005",
    descripcion: "Licencias Software",
    proyectoAsignado: "D+I",
    clienteOProveedor: "Interno",
    tipo: "egreso",
    montoPresupuestado: 15000000,
    mesPresupuestado: "Abril",
    estadoProyecto: "Negociación",
    ejecuciones: []
  },
  {
    id: "T-006",
    descripcion: "Consultoría Estratégica",
    proyectoAsignado: "PCF",
    clienteOProveedor: "Borondo",
    tipo: "egreso",
    montoPresupuestado: 30000000,
    mesPresupuestado: "Febrero",
    estadoProyecto: "Activo",
    ejecuciones: [
      { fechaEjecutado: "2026-02-20", montoEjecutado: 28000000 }
    ]
  },
  {
    id: "T-007",
    descripcion: "Implementación CRM",
    proyectoAsignado: "HTLR",
    clienteOProveedor: "Nonstop México",
    tipo: "ingreso",
    montoPresupuestado: 85000000,
    mesPresupuestado: "Julio",
    estadoProyecto: "Negociación",
    ejecuciones: [
      { fechaEjecutado: "2026-07-10", montoEjecutado: 20000000 }
    ]
  },
  {
    id: "T-008",
    descripcion: "Soporte TI Anual",
    proyectoAsignado: "D+I",
    clienteOProveedor: "Interno",
    tipo: "egreso",
    montoPresupuestado: 5000000,
    mesPresupuestado: "Enero",
    estadoProyecto: "Activo",
    ejecuciones: [
      { fechaEjecutado: "2026-01-05", montoEjecutado: 5000000 }
    ]
  }
];
