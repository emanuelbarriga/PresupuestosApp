import { describe, it, expect } from 'vitest';
import {
  getMonthFromDateStr,
  getDiferencia,
  buildTerceroGroups,
  buildMatrixData,
  computeFilteredTotals,
  filterAndSortRows,
  computeCellState,
  type ProjectRow,
} from '@/components/hooks/useBudgetMatrix';
import { MONTHS, type Month, type Budget, type EjecucionBudgetLink, type Ejecucion, type Project, type ProjectState } from '@/lib/types';

// ─── Factory helpers ───────────────────────────────────────────────

function makeBudget(overrides: Partial<Budget> & { id: string }): Budget {
  return {
    descripcion: '',
    projectId: '',
    projectName: '',
    entityId: '',
    entityName: '',
    entityType: 'client',
    tipo: 'ingreso',
    montoPresupuestado: 0,
    mesPresupuestado: 'Enero',
    fechaPresupuestado: '',
    estadoProyecto: 'Activo',
    ...overrides,
  };
}

function makeEjecucion(overrides: Partial<Ejecucion> & { id: string }): Ejecucion {
  return {
    descripcion: '',
    projectId: '',
    projectName: '',
    entityId: '',
    entityName: '',
    entityType: 'client',
    tipo: 'ingreso',
    montoEjecutado: 0,
    fechaEjecutado: '',
    comprobantes: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> & { id: string }): Project {
  return {
    name: '',
    clientId: '',
    clientName: '',
    estado: 'Activo',
    ...overrides,
  };
}

const resolveProjectName = (projectId: string, snapshotName: string): string =>
  projectId === 'proj-1' ? 'Proyecto Alpha' :
  projectId === 'proj-2' ? 'Proyecto Beta' :
  snapshotName || 'Sin proyecto';

// ─── getMonthFromDateStr ───────────────────────────────────────────

describe('getMonthFromDateStr', () => {
  it('extracts month from a standard date string', () => {
    expect(getMonthFromDateStr('2026-07-15')).toBe('Julio');
  });

  it('returns Enero for January', () => {
    expect(getMonthFromDateStr('2026-01-01')).toBe('Enero');
  });

  it('returns Diciembre for December', () => {
    expect(getMonthFromDateStr('2026-12-31')).toBe('Diciembre');
  });

  it('handles single-digit month and day', () => {
    expect(getMonthFromDateStr('2026-03-05')).toBe('Marzo');
  });

  it('handles 2-digit year dates', () => {
    expect(getMonthFromDateStr('2026-10-15')).toBe('Octubre');
  });
});

// ─── getDiferencia ─────────────────────────────────────────────────

describe('getDiferencia', () => {
  it('returns positive when ejecutado > presupuestado', () => {
    expect(getDiferencia(50, 100)).toBe(50);
  });

  it('returns negative when ejecutado < presupuestado', () => {
    expect(getDiferencia(100, 50)).toBe(-50);
  });

  it('returns zero when both are equal', () => {
    expect(getDiferencia(100, 100)).toBe(0);
  });

  it('handles zero values', () => {
    expect(getDiferencia(0, 0)).toBe(0);
    expect(getDiferencia(0, 50)).toBe(50);
    expect(getDiferencia(50, 0)).toBe(-50);
  });

  it('handles large numbers', () => {
    expect(getDiferencia(1_000_000, 2_500_000)).toBe(1_500_000);
  });
});

// ─── buildTerceroGroups ────────────────────────────────────────────

describe('buildTerceroGroups', () => {
  it('returns empty array with no data', () => {
    const result = buildTerceroGroups([], [], 'Ejecutado');
    expect(result).toEqual([]);
  });

  it('groups budgets by project and produces correct structure', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'p1', projectName: 'Proy 1', entityId: 'e1', entityName: 'Entity A', montoPresupuestado: 1000, tipo: 'ingreso' }),
      makeBudget({ id: 'b2', projectId: 'p1', projectName: 'Proy 1', entityId: 'e1', entityName: 'Entity A', montoPresupuestado: 2000, tipo: 'ingreso' }),
      makeBudget({ id: 'b3', projectId: 'p2', projectName: 'Proy 2', entityId: 'e2', entityName: 'Entity B', montoPresupuestado: 3000, tipo: 'ingreso' }),
    ];
    const result = buildTerceroGroups(budgets, [], 'Presupuestado');

    expect(result).toHaveLength(2);

    const proy1 = result.find(p => p.projectId === 'p1')!;
    expect(proy1).toBeDefined();
    expect(proy1.projectName).toBe('Proy 1');
    expect(proy1.groups).toHaveLength(1);
    expect(proy1.groups[0].entityName).toBe('Entity A');
    expect(proy1.groups[0].totalPresupuestado).toBe(3000);
    expect(proy1.totalPresupuestado).toBe(3000);

    const proy2 = result.find(p => p.projectId === 'p2')!;
    expect(proy2).toBeDefined();
    expect(proy2.groups).toHaveLength(1);
    expect(proy2.groups[0].totalPresupuestado).toBe(3000);
  });

  it('groups ejecuciones and computes diferencia', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'p1', projectName: 'Proy 1', entityId: 'e1', entityName: 'Entity A', montoPresupuestado: 5000, tipo: 'ingreso' }),
    ];
    const ejecuciones: Ejecucion[] = [
      makeEjecucion({ id: 'e1', projectId: 'p1', projectName: 'Proy 1', entityId: 'e1', entityName: 'Entity A', montoEjecutado: 3000, tipo: 'ingreso' }),
    ];
    const result = buildTerceroGroups(budgets, ejecuciones, 'Ejecutado');

    expect(result).toHaveLength(1);
    const proy = result[0];
    expect(proy.totalPresupuestado).toBe(5000);
    expect(proy.totalEjecutado).toBe(3000);
    expect(proy.diferencia).toBe(-2000);
    expect(proy.groups[0].diferencia).toBe(-2000);
  });

  it('filters out groups with zero totals', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'p1', projectName: 'Proy 1', entityId: 'e1', entityName: 'Entity A', montoPresupuestado: 1000, tipo: 'ingreso' }),
      makeBudget({ id: 'b2', projectId: 'p1', projectName: 'Proy 1', entityId: 'e2', entityName: 'Entity B', montoPresupuestado: 0, tipo: 'ingreso' }),
    ];
    const result = buildTerceroGroups(budgets, [], 'Presupuestado');

    expect(result).toHaveLength(1);
    expect(result[0].groups).toHaveLength(1);
    expect(result[0].groups[0].entityName).toBe('Entity A');
  });

  it('groups multiple entities within the same project', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'p1', projectName: 'Proy 1', entityId: 'e1', entityName: 'Client X', montoPresupuestado: 1000, tipo: 'ingreso' }),
      makeBudget({ id: 'b2', projectId: 'p1', projectName: 'Proy 1', entityId: 'e2', entityName: 'Provider Y', montoPresupuestado: 2000, tipo: 'ingreso' }),
    ];
    const result = buildTerceroGroups(budgets, [], 'Presupuestado');

    expect(result).toHaveLength(1);
    expect(result[0].groups).toHaveLength(2);
    expect(result[0].totalPresupuestado).toBe(3000);
  });

  it('handles missing projectId by using projectName', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: '', projectName: 'Sin-projecto', entityId: 'e1', entityName: 'Entity', montoPresupuestado: 500, tipo: 'ingreso' }),
    ];
    const result = buildTerceroGroups(budgets, [], 'Presupuestado');

    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('Sin-projecto');
  });
});

// ─── buildMatrixData ───────────────────────────────────────────────

describe('buildMatrixData', () => {
  const allMonths = MONTHS;

  it('returns empty rows with no budgets or ejecuciones', () => {
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets: [],
      ejecuciones: [],
      resolveProjectName,
    });
    expect(result.rows).toEqual([]);
    expect(result.colTotals.presupuestado.Enero).toBe(0);
    expect(result.colTotals.ejecutado.Enero).toBe(0);
    expect(result.grandTotalPresupuestado).toBe(0);
    expect(result.grandTotalEjecutado).toBe(0);
    expect(result.allMatrixBudgets).toEqual([]);
    expect(result.allMatrixEjecuciones).toEqual([]);
  });

  it('builds a single project row from a budget', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 5000, mesPresupuestado: 'Enero', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-15' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets,
      ejecuciones: [],
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.proyecto).toBe('Proyecto Alpha');
    expect(row.projectId).toBe('proj-1');
    expect(row.totalPresupuestado).toBe(5000);
    expect(row.presupuestoPorMes.Enero).toBe(5000);
    expect(row.presupuestoPorMes.Febrero).toBe(0);
    expect(row.totalEjecutado).toBe(0);
  });

  it('builds a single project row from an ejecucion with month extraction', () => {
    const ejecuciones: Ejecucion[] = [
      makeEjecucion({ id: 'e1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoEjecutado: 8000, fechaEjecutado: '2026-03-10', tipo: 'ingreso', entityId: 'e1', entityType: 'client' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets: [],
      ejecuciones,
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.ejecucionPorMes.Marzo).toBe(8000);
    expect(row.totalEjecutado).toBe(8000);
    expect(row.totalPresupuestado).toBe(0);
    expect(row.estado).toBe('Activo');
  });

  it('combines budget and ejecucion data for a project', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 10000, mesPresupuestado: 'Junio', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'En ejecución', fechaPresupuestado: '2026-06-01' }),
    ];
    const ejecuciones: Ejecucion[] = [
      makeEjecucion({ id: 'e1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoEjecutado: 6000, fechaEjecutado: '2026-06-15', tipo: 'ingreso', entityId: 'e1', entityType: 'client' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets,
      ejecuciones,
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.totalPresupuestado).toBe(10000);
    expect(row.totalEjecutado).toBe(6000);
    expect(row.presupuestoPorMes.Junio).toBe(10000);
    expect(row.ejecucionPorMes.Junio).toBe(6000);
  });

  it('builds tercero data within a project row', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'proj-1', projectName: 'Alpha', entityId: 'e1', entityName: 'Tercero A', montoPresupuestado: 5000, mesPresupuestado: 'Enero', tipo: 'ingreso', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-01' }),
      makeBudget({ id: 'b2', projectId: 'proj-1', projectName: 'Alpha', entityId: 'e2', entityName: 'Tercero B', montoPresupuestado: 3000, mesPresupuestado: 'Febrero', tipo: 'ingreso', entityType: 'provider', estadoProyecto: 'Activo', fechaPresupuestado: '2026-02-01' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets,
      ejecuciones: [],
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.terceroRows).toHaveLength(2);

    const terceroA = row.terceroRows.find(t => t.entityId === 'e1')!;
    expect(terceroA).toBeDefined();
    expect(terceroA.totalPresupuestado).toBe(5000);
    expect(terceroA.presupuestoPorMes.Enero).toBe(5000);

    const terceroB = row.terceroRows.find(t => t.entityId === 'e2')!;
    expect(terceroB).toBeDefined();
    expect(terceroB.totalPresupuestado).toBe(3000);
  });

  it('filters by tipo correctly (ingreso vs egreso)', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 1000, mesPresupuestado: 'Enero', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-01' }),
      makeBudget({ id: 'b2', projectId: 'proj-2', projectName: 'Beta', entityName: 'Vendor', montoPresupuestado: 2000, mesPresupuestado: 'Enero', tipo: 'egreso', entityId: 'e2', entityType: 'provider', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-01' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets,
      ejecuciones: [],
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].projectId).toBe('proj-1');
    expect(result.grandTotalPresupuestado).toBe(1000);
  });

  it('respects soloEgresos and soloIngresos project filters', () => {
    const projects: Project[] = [
      makeProject({ id: 'proj-1', name: 'Only Egresos', soloEgresos: true, clientName: '' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets: [],
      ejecuciones: [],
      allProjects: projects,
      resolveProjectName,
    });

    // proj-1 is soloEgresos, so it should NOT appear in 'ingreso' matrix
    expect(result.rows).toHaveLength(0);
  });

  it('computes colTotals and grand totals correctly across months', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 1000, mesPresupuestado: 'Enero', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-01' }),
      makeBudget({ id: 'b2', projectId: 'proj-2', projectName: 'Beta', entityName: 'Client2', montoPresupuestado: 2000, mesPresupuestado: 'Enero', tipo: 'ingreso', entityId: 'e2', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-01' }),
      makeBudget({ id: 'b3', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 3000, mesPresupuestado: 'Febrero', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-02-01' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets,
      ejecuciones: [],
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.colTotals.presupuestado.Enero).toBe(3000);
    expect(result.colTotals.presupuestado.Febrero).toBe(3000);
    expect(result.grandTotalPresupuestado).toBe(6000);
    expect(result.grandTotalEjecutado).toBe(0);
  });

  it('handles all projects list for pre-population', () => {
    const projects: Project[] = [
      makeProject({ id: 'proj-1', name: 'Alpha', clientName: 'Client A', estado: 'En ejecución' }),
      makeProject({ id: 'proj-2', name: 'Beta', clientName: 'Client B', estado: 'Aprobado' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: allMonths,
      budgets: [],
      ejecuciones: [],
      allProjects: projects,
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(2);
    const alpha = result.rows.find(r => r.projectId === 'proj-1')!;
    expect(alpha.cliente).toBe('Client A');
    expect(alpha.estado).toBe('En ejecución');
    expect(alpha.totalPresupuestado).toBe(0);
  });

  it('limits visibleMonths to only specified months for totals', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 1000, mesPresupuestado: 'Enero', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-01-01' }),
      makeBudget({ id: 'b2', projectId: 'proj-1', projectName: 'Alpha', entityName: 'Client', montoPresupuestado: 2000, mesPresupuestado: 'Marzo', tipo: 'ingreso', entityId: 'e1', entityType: 'client', estadoProyecto: 'Activo', fechaPresupuestado: '2026-03-01' }),
    ];
    const result = buildMatrixData({
      tipo: 'ingreso',
      visibleMonths: ['Enero', 'Febrero'] as Month[],
      budgets,
      ejecuciones: [],
      resolveProjectName,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    // Only Enero is in visibleMonths, Marzo is excluded
    expect(row.totalPresupuestado).toBe(1000);
    expect(row.presupuestoPorMes.Enero).toBe(1000);
    expect(row.presupuestoPorMes.Marzo).toBe(2000);
    expect(row.totalEjecutado).toBe(0);
  });
});

// ─── computeFilteredTotals ─────────────────────────────────────────

describe('computeFilteredTotals', () => {
  const makeRow = (overrides: Partial<ProjectRow>): ProjectRow => {
    const emptyMonth = () => Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>;
    const emptyBudgetMonth = () => Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>;
    const emptyEjecucionMonth = () => Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>;
    return {
      proyecto: '',
      projectId: '',
      cliente: '',
      estado: 'Activo',
      presupuestoPorMes: emptyMonth(),
      ejecucionPorMes: emptyMonth(),
      budgetsPorMes: emptyBudgetMonth(),
      ejecucionesPorMes: emptyEjecucionMonth(),
      allBudgets: [],
      allEjecuciones: [],
      terceroRows: [],
      totalPresupuestado: 0,
      totalEjecutado: 0,
      ...overrides,
    };
  };

  it('returns zero totals with empty rows', () => {
    const result = computeFilteredTotals([], MONTHS);
    expect(result.grandTotalPresupuestado).toBe(0);
    expect(result.grandTotalEjecutado).toBe(0);
    expect(result.colTotals.presupuestado.Enero).toBe(0);
  });

  it('computes totals from a single row', () => {
    const row = makeRow({
      proyecto: 'Test',
      totalPresupuestado: 5000,
      totalEjecutado: 3000,
      presupuestoPorMes: { ...Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>, Enero: 5000 },
      ejecucionPorMes: { ...Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>, Enero: 3000 },
    });
    const result = computeFilteredTotals([row], MONTHS);

    expect(result.grandTotalPresupuestado).toBe(5000);
    expect(result.grandTotalEjecutado).toBe(3000);
    expect(result.colTotals.presupuestado.Enero).toBe(5000);
    expect(result.colTotals.ejecutado.Enero).toBe(3000);
  });

  it('sums multiple rows correctly', () => {
    const base = () => Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>;
    const rows = [
      makeRow({ proyecto: 'A', totalPresupuestado: 1000, totalEjecutado: 500, presupuestoPorMes: { ...base(), Enero: 1000 }, ejecucionPorMes: { ...base(), Enero: 500 } }),
      makeRow({ proyecto: 'B', totalPresupuestado: 2000, totalEjecutado: 1500, presupuestoPorMes: { ...base(), Enero: 2000 }, ejecucionPorMes: { ...base(), Enero: 1500 } }),
    ];
    const result = computeFilteredTotals(rows, MONTHS);

    expect(result.grandTotalPresupuestado).toBe(3000);
    expect(result.grandTotalEjecutado).toBe(2000);
    expect(result.colTotals.presupuestado.Enero).toBe(3000);
  });

  it('respects visibleMonths subset for grand totals, colTotals tracks all months', () => {
    const base = () => Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>;
    const row = makeRow({
      proyecto: 'A',
      totalPresupuestado: 1000,
      presupuestoPorMes: { ...base(), Enero: 1000, Marzo: 2000 },
    });
    const result = computeFilteredTotals([row], ['Enero'] as Month[]);

    // grandTotal* respects the row's totalPresupuestado (already filtered by visibleMonths)
    expect(result.grandTotalPresupuestado).toBe(1000);
    // colTotals iterates all MONTHS (matching original Dashboard behavior)
    expect(result.colTotals.presupuestado.Enero).toBe(1000);
    expect(result.colTotals.presupuestado.Marzo).toBe(2000);
  });
});

// ─── filterAndSortRows ─────────────────────────────────────────────

describe('filterAndSortRows', () => {
  const makeRow = (overrides: Partial<ProjectRow>): ProjectRow => {
    const emptyMonth = () => Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>;
    const emptyBudgetMonth = () => Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>;
    const emptyEjecucionMonth = () => Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>;
    return {
      proyecto: '',
      projectId: '',
      cliente: '',
      estado: 'Activo',
      presupuestoPorMes: emptyMonth(),
      ejecucionPorMes: emptyMonth(),
      budgetsPorMes: emptyBudgetMonth(),
      ejecucionesPorMes: emptyEjecucionMonth(),
      allBudgets: [],
      allEjecuciones: [],
      terceroRows: [],
      totalPresupuestado: 0,
      totalEjecutado: 0,
      ...overrides,
    };
  };

  it('filters out Cancelado projects', () => {
    const rows = [
      makeRow({ proyecto: 'A', estado: 'Activo' }),
      makeRow({ proyecto: 'B', estado: 'Cancelado' }),
      makeRow({ proyecto: 'C', estado: 'En ejecución' }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: false, selectedProjects: new Set() });
    expect(result).toHaveLength(2);
    expect(result.find(r => r.estado === 'Cancelado')).toBeUndefined();
  });

  it('filters out Negociación when showNegociacion is false', () => {
    const rows = [
      makeRow({ proyecto: 'A', estado: 'Negociación' }),
      makeRow({ proyecto: 'B', estado: 'Activo' }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: false, selectedProjects: new Set() });
    expect(result).toHaveLength(1);
    expect(result[0].proyecto).toBe('B');
  });

  it('keeps Negociación when showNegociacion is true', () => {
    const rows = [
      makeRow({ proyecto: 'A', estado: 'Negociación' }),
      makeRow({ proyecto: 'B', estado: 'Activo' }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: true, selectedProjects: new Set() });
    expect(result).toHaveLength(2);
  });

  it('filters by selectedProjects', () => {
    const rows = [
      makeRow({ proyecto: 'A', projectId: 'p1' }),
      makeRow({ proyecto: 'B', projectId: 'p2' }),
      makeRow({ proyecto: 'C', projectId: 'p3' }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: false, selectedProjects: new Set(['p1', 'p3']) });
    expect(result).toHaveLength(2);
    expect(result.map(r => r.projectId)).toEqual(['p1', 'p3']);
  });

  it('sorts by estado order: En ejecución < Aprobado < Finalizado < Negociación', () => {
    const rows = [
      makeRow({ proyecto: 'C', estado: 'Finalizado' as ProjectState }),
      makeRow({ proyecto: 'A', estado: 'En ejecución' }),
      makeRow({ proyecto: 'B', estado: 'Aprobado' as ProjectState }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: true, selectedProjects: new Set() });
    expect(result.map(r => r.estado)).toEqual(['En ejecución', 'Aprobado', 'Finalizado']);
  });

  it('sorts alphabetically within the same estado', () => {
    const rows = [
      makeRow({ proyecto: 'Zeta', estado: 'Activo' }),
      makeRow({ proyecto: 'Alpha', estado: 'Activo' }),
      makeRow({ proyecto: 'Beta', estado: 'Activo' }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: false, selectedProjects: new Set() });
    expect(result.map(r => r.proyecto)).toEqual(['Alpha', 'Beta', 'Zeta']);
  });

  it('returns empty array for empty input', () => {
    const result = filterAndSortRows([], { showNegociacion: false, selectedProjects: new Set() });
    expect(result).toEqual([]);
  });

  it('handles unknown estados with high sort order', () => {
    const rows = [
      makeRow({ proyecto: 'A', estado: 'Activo' }),
      makeRow({ proyecto: 'B', estado: 'SomeUnknown' as ProjectState }),
    ];
    const result = filterAndSortRows(rows, { showNegociacion: false, selectedProjects: new Set() });
    // Activo (no estadoOrder entry → 99) should come after Unknown (also 99), alphabetically A comes first
    expect(result[0].proyecto).toBe('A');
    expect(result[1].proyecto).toBe('B');
  });
});

// ─── computeCellState ──────────────────────────────────────────────

describe('computeCellState', () => {
  function makeBudget(overrides: Partial<Budget> & { id: string }): Budget {
    return {
      descripcion: '',
      projectId: '',
      projectName: '',
      entityId: '',
      entityName: '',
      entityType: 'client',
      tipo: 'egreso',
      montoPresupuestado: 1000,
      mesPresupuestado: 'Enero',
      fechaPresupuestado: '2026-01',
      estadoProyecto: 'Activo',
      ...overrides,
    };
  }

  function makeLink(overrides: Partial<EjecucionBudgetLink> & { monto: number }): EjecucionBudgetLink {
    return {
      id: 'l1',
      companyId: 'c1',
      budgetId: 'b1',
      ...overrides,
    };
  }

  it('returns pending when no links exist', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    const result = computeCellState(budget, []);

    expect(result.estado).toBe('pending');
    expect(result.presupuestado).toBe(1000);
    expect(result.ejecutado).toBe(0);
    expect(result.porEjecutar).toBe(1000);
  });

  it('returns over-run when ejecutado > presupuestado (checked before completed)', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    const links = [
      makeLink({ monto: 600 }),
      makeLink({ monto: 600 }),
    ];
    const result = computeCellState(budget, links);

    expect(result.estado).toBe('over-run');
    expect(result.ejecutado).toBe(1200);
    expect(result.porEjecutar).toBe(0); // Math.max clamps to 0
  });

  it('returns completed when porEjecutar === 0 (ejecutado === presupuestado)', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    const links = [
      makeLink({ monto: 400 }),
      makeLink({ monto: 600 }),
    ];
    const result = computeCellState(budget, links);

    expect(result.estado).toBe('completed');
    expect(result.ejecutado).toBe(1000);
    expect(result.porEjecutar).toBe(0);
  });

  it('returns completed when any link has tipo_cierre=total', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    const links = [
      makeLink({ monto: 400, tipo_cierre: 'total' }),
    ];
    const result = computeCellState(budget, links);

    expect(result.estado).toBe('completed');
    expect(result.ejecutado).toBe(400);
    expect(result.porEjecutar).toBe(600); // Still shows remaining
  });

  it('returns partial when links exist but no closure and ejecutado < presupuestado', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    const links = [
      makeLink({ monto: 400 }),
    ];
    const result = computeCellState(budget, links);

    expect(result.estado).toBe('partial');
    expect(result.ejecutado).toBe(400);
    expect(result.porEjecutar).toBe(600);
  });

  it('handles null-safe fallback: missing tipo_cierre is treated as partial', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    // Link without tipo_cierre → treat as partial
    const links = [
      { id: 'l1', companyId: 'c1', budgetId: 'b1', monto: 300 } as EjecucionBudgetLink,
    ];
    const result = computeCellState(budget, links);

    expect(result.estado).toBe('partial');
    expect(result.ejecutado).toBe(300);
  });

  it('includes variacionCambiaria from budget', () => {
    const budget = makeBudget({ id: 'b1', montoPresupuestado: 1000 });
    const links: EjecucionBudgetLink[] = [];
    const result = computeCellState(budget, links);

    expect(result.variacionCambiaria).toBe(0);
  });
});
