'use client'

import { useMemo } from 'react';
import { MONTHS, Month, Budget, Ejecucion, TransactionType, ProjectState, Project, DetalleTerceroGroup } from '@/lib/types';

// ─── Leaf helpers ──────────────────────────────────────────────────

export const getMonthFromDateStr = (dateString: string): Month => {
  const monthIndex = parseInt(dateString.split('-')[1], 10) - 1;
  return MONTHS[monthIndex];
};

export const getDiferencia = (presupuestado: number, ejecutado: number): number =>
  ejecutado - presupuestado;

// ─── Internal types ─────────────────────────────────────────────────

export interface TerceroRowdata {
  entityId: string;
  entityName: string;
  entityType: string;
  presupuestoPorMes: Record<Month, number>;
  ejecucionPorMes: Record<Month, number>;
  budgetsPorMes: Record<Month, Budget[]>;
  ejecucionesPorMes: Record<Month, Ejecucion[]>;
  allBudgets: Budget[];
  allEjecuciones: Ejecucion[];
  totalPresupuestado: number;
  totalEjecutado: number;
}

export interface ProjectRowData {
  proyecto: string;
  cliente: string;
  projectId: string;
  estado: ProjectState;
  presupuestoPorMes: Record<Month, number>;
  ejecucionPorMes: Record<Month, number>;
  budgetsPorMes: Record<Month, Budget[]>;
  ejecucionesPorMes: Record<Month, Ejecucion[]>;
  allBudgets: Budget[];
  allEjecuciones: Ejecucion[];
  terceros: Map<string, TerceroRowdata>;
}

export interface ProjectRow {
  proyecto: string;
  projectId: string;
  cliente: string;
  estado: ProjectState;
  presupuestoPorMes: Record<Month, number>;
  ejecucionPorMes: Record<Month, number>;
  budgetsPorMes: Record<Month, Budget[]>;
  ejecucionesPorMes: Record<Month, Ejecucion[]>;
  allBudgets: Budget[];
  allEjecuciones: Ejecucion[];
  terceroRows: (TerceroRowdata & { totalPresupuestado: number; totalEjecutado: number })[];
  totalPresupuestado: number;
  totalEjecutado: number;
}

export interface MatrixDataResult {
  rows: ProjectRow[];
  colTotals: { presupuestado: Record<Month, number>; ejecutado: Record<Month, number> };
  grandTotalPresupuestado: number;
  grandTotalEjecutado: number;
  allMatrixBudgets: Budget[];
  allMatrixEjecuciones: Ejecucion[];
}

export interface FilterOptions {
  showNegociacion: boolean;
  selectedProjects: Set<string>;
}

export interface FilteredTotals {
  colTotals: { presupuestado: Record<Month, number>; ejecutado: Record<Month, number> };
  grandTotalPresupuestado: number;
  grandTotalEjecutado: number;
}

export interface MatrixDataParams {
  tipo: TransactionType;
  visibleMonths: Month[];
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  allProjects?: Project[];
  resolveProjectName: (projectId: string, snapshotName: string) => string;
}

// ─── buildMatrixData — EXACT port of matrixData useMemo ────────────

export function buildMatrixData(params: MatrixDataParams): MatrixDataResult {
  const { tipo, visibleMonths, budgets, ejecuciones, allProjects, resolveProjectName } = params;

  const getKey = (projectId: string, projectName: string) => projectId || projectName || 'Sin proyecto';

  const projectsMap = new Map<string, ProjectRowData>();

  // Pre-populate with projects (skip soloEgresos for Ingresos, soloIngresos for Egresos)
  (allProjects || []).filter(p => {
    if (p.soloEgresos && tipo !== 'egreso') return false;
    if (p.soloIngresos && tipo !== 'ingreso') return false;
    return true;
  }).forEach(p => {
    const key = getKey(p.id, p.name);
    if (!projectsMap.has(key)) {
      const emptyMonth = () => Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>;
      const emptyMonthBudgetArr = () => Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>;
      const emptyMonthEjecucionArr = () => Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>;
      projectsMap.set(key, {
        proyecto: resolveProjectName(p.id, p.name),
        projectId: p.id,
        cliente: p.clientName || '',
        estado: p.estado as ProjectState,
        presupuestoPorMes: emptyMonth(),
        ejecucionPorMes: emptyMonth(),
        budgetsPorMes: emptyMonthBudgetArr(),
        ejecucionesPorMes: emptyMonthEjecucionArr(),
        allBudgets: [],
        allEjecuciones: [],
        terceros: new Map(),
      });
    }
  });

  const relevantBudgets = budgets.filter(b => b.tipo === tipo);
  const relevantEjecuciones = ejecuciones.filter(e => e.tipo === tipo);

  const initTercero = (eid: string, ename: string, etype: string): TerceroRowdata => {
    const empty = () => Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>;
    const emptyB = () => Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>;
    const emptyE = () => Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>;
    return {
      entityId: eid,
      entityName: ename,
      entityType: etype,
      presupuestoPorMes: empty(),
      ejecucionPorMes: empty(),
      budgetsPorMes: emptyB(),
      ejecucionesPorMes: emptyE(),
      allBudgets: [] as Budget[],
      allEjecuciones: [] as Ejecucion[],
      totalPresupuestado: 0,
      totalEjecutado: 0,
    };
  };

  relevantBudgets.forEach(b => {
    const key = getKey(b.projectId, b.projectName);
    if (!projectsMap.has(key)) {
      projectsMap.set(key, {
        proyecto: resolveProjectName(b.projectId, b.projectName),
        projectId: b.projectId,
        cliente: b.entityName,
        estado: b.estadoProyecto,
        presupuestoPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
        ejecucionPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
        budgetsPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>,
        ejecucionesPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>,
        allBudgets: [],
        allEjecuciones: [],
        terceros: new Map(),
      });
    }
    const pd = projectsMap.get(key)!;
    pd.allBudgets.push(b);
    pd.presupuestoPorMes[b.mesPresupuestado] += b.montoPresupuestado;
    pd.budgetsPorMes[b.mesPresupuestado].push(b);

    // Track tercero data
    const eid = b.entityId || b.entityName || 'sin-entity';
    if (!pd.terceros.has(eid)) {
      pd.terceros.set(eid, initTercero(eid, b.entityName, b.entityType));
    }
    const t = pd.terceros.get(eid)!;
    t.allBudgets.push(b);
    t.presupuestoPorMes[b.mesPresupuestado] += b.montoPresupuestado;
    t.budgetsPorMes[b.mesPresupuestado].push(b);
    t.totalPresupuestado += b.montoPresupuestado;
  });

  relevantEjecuciones.forEach(e => {
    const key = getKey(e.projectId, e.projectName);
    if (!projectsMap.has(key)) {
      projectsMap.set(key, {
        proyecto: resolveProjectName(e.projectId, e.projectName),
        projectId: e.projectId,
        cliente: e.entityName,
        estado: 'Activo' as ProjectState,
        presupuestoPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
        ejecucionPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
        budgetsPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>,
        ejecucionesPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>,
        allBudgets: [],
        allEjecuciones: [],
        terceros: new Map(),
      });
    }
    const pd = projectsMap.get(key)!;
    pd.allEjecuciones.push(e);
    const ejMonth = getMonthFromDateStr(e.fechaEjecutado);
    pd.ejecucionPorMes[ejMonth] += e.montoEjecutado;
    pd.ejecucionesPorMes[ejMonth].push(e);

    // Track tercero data
    const eid = e.entityId || e.entityName || 'sin-entity';
    if (!pd.terceros.has(eid)) {
      pd.terceros.set(eid, initTercero(eid, e.entityName, e.entityType));
    }
    const t = pd.terceros.get(eid)!;
    t.allEjecuciones.push(e);
    t.ejecucionPorMes[ejMonth] += e.montoEjecutado;
    t.ejecucionesPorMes[ejMonth].push(e);
    t.totalEjecutado += e.montoEjecutado;
  });

  const rows = Array.from(projectsMap.entries()).map(([_key, data]) => {
    const totalPresupuestado = visibleMonths.reduce((sum, m) => sum + data.presupuestoPorMes[m], 0);
    const totalEjecutado = visibleMonths.reduce((sum, m) => sum + data.ejecucionPorMes[m], 0);
    // Compute visible tercero groups (filter zero-activity, compute visible totals)
    const terceroRows = Array.from(data.terceros.values())
      .map(t => {
        const vPresupuestado = visibleMonths.reduce((s, m) => s + t.presupuestoPorMes[m], 0);
        const vEjecutado = visibleMonths.reduce((s, m) => s + t.ejecucionPorMes[m], 0);
        return { ...t, totalPresupuestado: vPresupuestado, totalEjecutado: vEjecutado };
      })
      .filter(t => t.totalPresupuestado !== 0 || t.totalEjecutado !== 0);
    return { ...data, proyecto: data.proyecto, projectId: data.projectId, totalPresupuestado, totalEjecutado, terceroRows };
  });

  const colTotals = {
    presupuestado: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
    ejecutado: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
  };
  let grandTotalPresupuestado = 0;
  let grandTotalEjecutado = 0;
  let allMatrixBudgets: Budget[] = [];
  let allMatrixEjecuciones: Ejecucion[] = [];

  rows.forEach(r => {
    MONTHS.forEach(m => {
      colTotals.presupuestado[m] += r.presupuestoPorMes[m];
      colTotals.ejecutado[m] += r.ejecucionPorMes[m];
    });
    grandTotalPresupuestado += r.totalPresupuestado;
    grandTotalEjecutado += r.totalEjecutado;
    allMatrixBudgets = [...allMatrixBudgets, ...visibleMonths.flatMap(m => r.budgetsPorMes[m])];
    allMatrixEjecuciones = [...allMatrixEjecuciones, ...visibleMonths.flatMap(m => r.ejecucionesPorMes[m])];
  });

  return { rows, colTotals, grandTotalPresupuestado, grandTotalEjecutado, allMatrixBudgets, allMatrixEjecuciones };
}

// ─── computeFilteredTotals — EXACT port of filteredTotals useMemo ──

export function computeFilteredTotals(rows: ProjectRow[], visibleMonths: Month[]): FilteredTotals {
  const colTotals = {
    presupuestado: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
    ejecutado: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
  };
  let grandTotalPresupuestado = 0;
  let grandTotalEjecutado = 0;
  rows.forEach(r => {
    MONTHS.forEach(m => {
      colTotals.presupuestado[m] += r.presupuestoPorMes[m];
      colTotals.ejecutado[m] += r.ejecucionPorMes[m];
    });
    grandTotalPresupuestado += r.totalPresupuestado;
    grandTotalEjecutado += r.totalEjecutado;
  });
  return { colTotals, grandTotalPresupuestado, grandTotalEjecutado };
}

// ─── filterAndSortRows — EXACT port of visibleRows useMemo ────────

export function filterAndSortRows(rows: ProjectRow[], options: FilterOptions): ProjectRow[] {
  const { showNegociacion, selectedProjects } = options;

  // Estado sort order (lower = first)
  const estadoOrder: Record<string, number> = {
    'En ejecución': 0,
    'Aprobado': 1,
    'Finalizado': 2,
    'Negociación': 3,
  };

  let result = rows
    // Exclude Cancelado projects
    .filter(row => row.estado !== 'Cancelado')
    // Apply Negociación filter
    .filter(row => showNegociacion || row.estado !== 'Negociación');

  // Filtrar por proyectos seleccionados (si hay alguno seleccionado)
  if (selectedProjects.size > 0) {
    result = result.filter(r => selectedProjects.has(r.projectId || r.proyecto));
  }

  // Ordenar: primero por estado (según el orden definido), luego alfabético
  result = [...result].sort((a, b) => {
    const orderA = estadoOrder[a.estado] ?? 99;
    const orderB = estadoOrder[b.estado] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return (a.proyecto || '').localeCompare(b.proyecto || '');
  });

  return result;
}

// ─── buildTerceroGroups — moved from Dashboard.tsx ─────────────────

export function buildTerceroGroups(
  budgets: Budget[],
  ejecuciones: Ejecucion[],
  _mode: 'Presupuestado' | 'Ejecutado',
): {
  projectId: string;
  projectName: string;
  groups: DetalleTerceroGroup[];
  totalPresupuestado: number;
  totalEjecutado: number;
  diferencia: number;
}[] {
  // 1. Group budgets by projectId
  const budgetsByProject = new Map<string, Budget[]>();
  for (const b of budgets) {
    const key = b.projectId || b.projectName || 'Sin proyecto';
    if (!budgetsByProject.has(key)) budgetsByProject.set(key, []);
    budgetsByProject.get(key)!.push(b);
  }

  // 2. Group ejecuciones by projectId
  const ejecucionesByProject = new Map<string, Ejecucion[]>();
  for (const e of ejecuciones) {
    const key = e.projectId || e.projectName || 'Sin proyecto';
    if (!ejecucionesByProject.has(key)) ejecucionesByProject.set(key, []);
    ejecucionesByProject.get(key)!.push(e);
  }

  // 3. All unique project IDs
  const allProjectIds = new Set([...budgetsByProject.keys(), ...ejecucionesByProject.keys()]);
  const projects: {
    projectId: string;
    projectName: string;
    groups: DetalleTerceroGroup[];
    totalPresupuestado: number;
    totalEjecutado: number;
    diferencia: number;
  }[] = [];

  for (const projectId of allProjectIds) {
    const projectBudgets = budgetsByProject.get(projectId) || [];
    const projectEjecuciones = ejecucionesByProject.get(projectId) || [];

    // Resolve project name from first record found
    const projectName = projectBudgets[0]?.projectName || projectEjecuciones[0]?.projectName || 'Sin proyecto';

    // Group by entityId within project
    const groupsByEntity = new Map<string, {
      entityId: string;
      entityName: string;
      entityType: 'client' | 'provider' | 'interno' | '';
      budgets: Budget[];
      ejecuciones: Ejecucion[];
    }>();

    for (const b of projectBudgets) {
      const eid = b.entityId || b.entityName || 'sin-entity';
      if (!groupsByEntity.has(eid)) {
        groupsByEntity.set(eid, { entityId: b.entityId, entityName: b.entityName, entityType: b.entityType, budgets: [], ejecuciones: [] });
      }
      groupsByEntity.get(eid)!.budgets.push(b);
    }

    for (const e of projectEjecuciones) {
      const eid = e.entityId || e.entityName || 'sin-entity';
      if (!groupsByEntity.has(eid)) {
        groupsByEntity.set(eid, { entityId: e.entityId, entityName: e.entityName, entityType: e.entityType, budgets: [], ejecuciones: [] });
      }
      groupsByEntity.get(eid)!.ejecuciones.push(e);
    }

    const groups: DetalleTerceroGroup[] = [];
    let projectTotalPresupuestado = 0;
    let projectTotalEjecutado = 0;

    for (const [, g] of groupsByEntity) {
      const totalPresupuestado = g.budgets.reduce((sum, b) => sum + b.montoPresupuestado, 0);
      const totalEjecutado = g.ejecuciones.reduce((sum, e) => sum + e.montoEjecutado, 0);

      // Skip groups where both totals are 0
      if (totalPresupuestado === 0 && totalEjecutado === 0) continue;

      groups.push({
        entityId: g.entityId,
        entityName: g.entityName,
        entityType: g.entityType,
        budgets: g.budgets,
        ejecuciones: g.ejecuciones,
        totalPresupuestado,
        totalEjecutado,
        diferencia: totalEjecutado - totalPresupuestado,
      });

      projectTotalPresupuestado += totalPresupuestado;
      projectTotalEjecutado += totalEjecutado;
    }

    // Skip projects with no tercero groups
    if (groups.length === 0) continue;

    projects.push({
      projectId,
      projectName,
      groups,
      totalPresupuestado: projectTotalPresupuestado,
      totalEjecutado: projectTotalEjecutado,
      diferencia: projectTotalEjecutado - projectTotalPresupuestado,
    });
  }

  return projects;
}

// ─── Hook ───────────────────────────────────────────────────────────

export interface UseBudgetMatrixParams {
  tipo: TransactionType;
  showNegociacion: boolean;
  visibleMonths: Month[];
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  resolveProjectName: (projectId: string, snapshotName: string) => string;
  allProjects?: Project[];
  selectedProjects: Set<string>;
}

export interface UseBudgetMatrixResult {
  rows: ProjectRow[];
  colTotals: { presupuestado: Record<Month, number>; ejecutado: Record<Month, number> };
  grandTotalPresupuestado: number;
  grandTotalEjecutado: number;
  allMatrixBudgets: Budget[];
  allMatrixEjecuciones: Ejecucion[];
}

export function useBudgetMatrix(params: UseBudgetMatrixParams): UseBudgetMatrixResult {
  const { tipo, showNegociacion, visibleMonths, budgets, ejecuciones, resolveProjectName, allProjects, selectedProjects } = params;

  const { rows: rawRows, allMatrixBudgets, allMatrixEjecuciones } = useMemo(
    () => buildMatrixData({ tipo, visibleMonths, budgets, ejecuciones, allProjects, resolveProjectName }),
    [tipo, visibleMonths, budgets, ejecuciones, allProjects],
  );

  const rows = useMemo(
    () => filterAndSortRows(rawRows, { showNegociacion, selectedProjects }),
    [rawRows, showNegociacion, selectedProjects],
  );

  const totals = useMemo(
    () => computeFilteredTotals(rows, visibleMonths),
    [rows, visibleMonths],
  );

  return {
    rows,
    colTotals: totals.colTotals,
    grandTotalPresupuestado: totals.grandTotalPresupuestado,
    grandTotalEjecutado: totals.grandTotalEjecutado,
    allMatrixBudgets,
    allMatrixEjecuciones,
  };
}
