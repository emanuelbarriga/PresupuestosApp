'use client'

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { SidepanelData, MONTHS, Month, ProjectState, Budget, Ejecucion, TransactionType, Project, DetalleTerceroGroup, RecordDetail } from '@/lib/types';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, CalendarRange } from 'lucide-react';
import clsx from 'clsx';

const currentYear = new Date().getFullYear();

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

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

interface DashboardProps {
  onCellClick: (data: SidepanelData) => void;
  onProjectClick?: (projectId: string, projectName: string) => void;
  onEmptyCellClick?: (projectId: string, projectName: string, month: Month, tipo: TransactionType, mode: 'Presupuestado' | 'Ejecutado') => void;
  onTerceroClick?: (detail: RecordDetail) => void;
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  projects?: Project[];
}

const getMonthFromDateStr = (dateString: string): Month => {
  const monthIndex = parseInt(dateString.split('-')[1], 10) - 1;
  return MONTHS[monthIndex];
};

export function Dashboard({ onCellClick, onProjectClick, onEmptyCellClick, onTerceroClick, budgets, ejecuciones, projects }: DashboardProps) {
  const [mode, setMode] = useState<'Presupuestado' | 'Ejecutado'>('Presupuestado');
  const [timeView, setTimeView] = useState<'year' | '5months'>('year');
  const [centerMonthIdx, setCenterMonthIdx] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showNegociacion, setShowNegociacion] = useState(false);
  const [showArchivados, setShowArchivados] = useState(false);
  const [ingresoTotals, setIngresoTotals] = useState({ presupuestado: 0, ejecutado: 0 });
  const [egresoTotals, setEgresoTotals] = useState({ presupuestado: 0, ejecutado: 0 });

  const visibleMonths = useMemo(() => {
    if (timeView === 'year') return MONTHS;
    let start = Math.max(0, centerMonthIdx - 2);
    let end = Math.min(11, start + 4);
    if (end - start < 4) start = Math.max(0, end - 4);
    return MONTHS.slice(start, end + 1);
  }, [timeView, centerMonthIdx]);

  const handlePrevMonth = () => setCenterMonthIdx(prev => Math.max(2, prev - 1));
  const handleNextMonth = () => setCenterMonthIdx(prev => Math.min(9, prev + 1));

  // Resolve live project name from projects list, fallback to snapshot
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (projects || []).forEach(p => { if (p.id) map.set(p.id, p.name); });
    return map;
  }, [projects]);
  const projectByNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (projects || []).forEach(p => { if (p.name) map.set(p.name, p.id); });
    return map;
  }, [projects]);
  const resolveProjectName = (projectId: string, snapshotName: string): string => {
    if (projectId && projectNameMap.has(projectId)) return projectNameMap.get(projectId)!;
    // Pre-migration fallback: try to find project by snapshot name
    const id = snapshotName ? projectByNameMap.get(snapshotName) : undefined;
    if (id && projectNameMap.has(id)) return projectNameMap.get(id)!;
    return snapshotName || 'Sin proyecto';
  };
  const resolveProjectId = (projectId: string, snapshotName: string): string => {
    if (projectId) return projectId;
    // Pre-migration fallback: look up by snapshot name
    return snapshotName ? projectByNameMap.get(snapshotName) || '' : '';
  };

  const yearStr = String(selectedYear);
  const filteredBudgets = useMemo(
    () => budgets.filter(b => (b.fechaPresupuestado || '').startsWith(yearStr) && (showArchivados || b.archivado !== true)),
    [budgets, yearStr, showArchivados],
  );
  const filteredEjecuciones = useMemo(
    () => ejecuciones.filter(e => e.fechaEjecutado?.startsWith(yearStr) && (showArchivados || e.archivado !== true)),
    [ejecuciones, yearStr, showArchivados],
  );

  const hasTerceroData = filteredBudgets.length > 0 || filteredEjecuciones.length > 0;

  const handleTerceroClick = () => {
    const projects = buildTerceroGroups(filteredBudgets, filteredEjecuciones, mode);
    const totalPresupuestado = projects.reduce((s, p) => s + p.totalPresupuestado, 0);
    const totalEjecutado = projects.reduce((s, p) => s + p.totalEjecutado, 0);
    onTerceroClick?.({
      type: 'detalle-tercero',
      projects,
      totalPresupuestado,
      totalEjecutado,
      diferencia: totalEjecutado - totalPresupuestado,
    });
  };

  return (
    <div className={clsx("flex-1 flex flex-col min-w-0 h-full transition-colors", mode === 'Presupuestado' ? "bg-sky-50/30" : "bg-slate-50")}>
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-white border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Dashboard Presupuestal</h1>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-500">Matriz de control de Ingresos y Egresos</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border p-1 rounded-lg bg-slate-100 border-slate-200">
            <button onClick={() => setTimeView('year')} className={clsx("p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors", timeView === 'year' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700')}>
              <Calendar size={14} /> Año
            </button>
            <button onClick={() => setTimeView('5months')} className={clsx("p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors", timeView === '5months' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700')}>
              <CalendarRange size={14} /> 5 Meses
            </button>
            {timeView === '5months' && (
              <div className="flex items-center ml-1 border-l pl-1 border-slate-200">
                <button onClick={handlePrevMonth} disabled={centerMonthIdx <= 2} className="p-1 disabled:opacity-30 text-slate-400 hover:text-slate-600"><ChevronLeft size={16}/></button>
                <button onClick={handleNextMonth} disabled={centerMonthIdx >= 9} className="p-1 disabled:opacity-30 text-slate-400 hover:text-slate-600"><ChevronRight size={16}/></button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 border p-1 rounded-lg bg-slate-100 border-slate-200">
            <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"><ChevronLeft size={14}/></button>
            <span className="px-2 text-xs font-bold text-slate-700 min-w-[48px] text-center select-none">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"><ChevronRight size={14}/></button>
          </div>
          <div className="p-1 rounded-lg flex border bg-slate-100 border-slate-200">
            <button className={clsx("px-4 py-1 text-xs font-bold rounded-md transition-colors", mode === 'Presupuestado' ? "bg-sky-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")} onClick={() => setMode('Presupuestado')}>Presupuestado</button>
            <button className={clsx("px-4 py-1 text-xs font-bold rounded-md transition-colors", mode === 'Ejecutado' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")} onClick={() => setMode('Ejecutado')}>Ejecutado</button>
          </div>
          {/* HIDDEN: se activará cuando implementemos filas expandibles en la matriz
          {hasTerceroData && (
            <button onClick={handleTerceroClick} className="px-3 py-1 text-[10px] font-bold rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center gap-1.5">
              Detalle por Tercero
            </button>
          )} */}
          <button onClick={() => setShowNegociacion(prev => !prev)} className={clsx("px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors", showNegociacion ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-100 text-slate-500 border-slate-200")}>
            Negociación {showNegociacion ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => setShowArchivados(prev => !prev)} className={clsx("px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors", showArchivados ? "bg-slate-700 text-white border-slate-600" : "bg-slate-100 text-slate-500 border-slate-200")}>
            {showArchivados ? 'Ocultar archivados' : 'Mostrar archivados'}
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 flex gap-4 shrink-0">
        <KpiCard label="Total Ingresos" value={mode === 'Presupuestado' ? ingresoTotals.presupuestado : ingresoTotals.ejecutado} color="emerald" />
        <KpiCard label="Total Egresos" value={mode === 'Presupuestado' ? egresoTotals.presupuestado : egresoTotals.ejecutado} color="rose" />
        {(() => {
          const ingresos = mode === 'Presupuestado' ? ingresoTotals.presupuestado : ingresoTotals.ejecutado;
          const egresos = mode === 'Presupuestado' ? egresoTotals.presupuestado : egresoTotals.ejecutado;
          const utilidad = ingresos - egresos;
          const pct = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
          return (
            <>
              <KpiCard label="Utilidad" value={utilidad} color={utilidad >= 0 ? 'emerald' : 'rose'} />
              <KpiCard label="% Utilidad" value={pct} color={pct >= 0 ? 'emerald' : 'rose'} isPercentage />
            </>
          );
        })()}
      </div>

      <div className="p-4 flex-1 overflow-auto flex flex-col gap-6">
        <Matrix tipo="ingreso" showNegociacion={showNegociacion} mode={mode} onCellClick={onCellClick} onProjectClick={onProjectClick} onEmptyCellClick={onEmptyCellClick} onReportTotals={setIngresoTotals} visibleMonths={visibleMonths} budgets={filteredBudgets} ejecuciones={filteredEjecuciones} resolveProjectName={resolveProjectName} allProjects={projects} />
        <Matrix tipo="egreso" showNegociacion={showNegociacion} mode={mode} onCellClick={onCellClick} onProjectClick={onProjectClick} onEmptyCellClick={onEmptyCellClick} onReportTotals={setEgresoTotals} visibleMonths={visibleMonths} budgets={filteredBudgets} ejecuciones={filteredEjecuciones} resolveProjectName={resolveProjectName} allProjects={projects} />
      </div>
    </div>
  );
}

interface MatrixProps {
  tipo: TransactionType;
  showNegociacion: boolean;
  mode: 'Presupuestado' | 'Ejecutado';
  onCellClick: (data: SidepanelData) => void;
  onProjectClick?: (projectId: string, projectName: string) => void;
  onEmptyCellClick?: (projectId: string, projectName: string, month: Month, tipo: TransactionType, mode: 'Presupuestado' | 'Ejecutado') => void;
  onReportTotals?: (totals: { presupuestado: number; ejecutado: number }) => void;
  visibleMonths: Month[];
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  resolveProjectName: (projectId: string, snapshotName: string) => string;
  allProjects?: Project[];
}

function Matrix({ tipo, showNegociacion, mode, onCellClick, onProjectClick, onEmptyCellClick, onReportTotals, visibleMonths, budgets, ejecuciones, resolveProjectName, allProjects }: MatrixProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const toggleProject = (key: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isP = mode === 'Presupuestado';
  const colorTheme = tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600';
  const hoverBgTheme = tipo === 'ingreso' ? (isP ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-emerald-50/50 hover:text-emerald-700') : (isP ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-rose-50/50 hover:text-rose-700');
  const currentMonthIdx = new Date().getMonth();
  const currentMonthStr = MONTHS[currentMonthIdx];

  const matrixData = useMemo(() => {
    type TerceroRowdata = {
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
    };
    const projectsMap = new Map<string, {
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
    }>();

    const getKey = (projectId: string, projectName: string) => projectId || projectName || 'Sin proyecto';

    // Pre-populate with projects (skip soloEgresos for Ingresos matrix)
    (allProjects || []).filter(p => tipo === 'egreso' || !p.soloEgresos).forEach(p => {
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

    const initTercero = (eid: string, ename: string, etype: string) => {
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

    const rows = Array.from(projectsMap.entries()).map(([key, data]) => {
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
  }, [tipo, visibleMonths, budgets, ejecuciones, allProjects]);

  const badgeColors: Record<string, string> = {
    'Activo': isP ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-100 text-emerald-700',
    'Cerrado': isP ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-600',
    'Negociación': isP ? 'bg-orange-100 text-orange-800' : 'bg-orange-100 text-orange-700',
    'En ejecución': isP ? 'bg-blue-100 text-blue-800' : 'bg-blue-100 text-blue-700',
    'Cancelado': isP ? 'bg-red-100 text-red-800' : 'bg-red-100 text-red-700'
  };

  const title = `${tipo.toUpperCase()}S ${mode.toUpperCase()}S`;

  const visibleRows = useMemo(
    () => matrixData.rows.filter(row => showNegociacion || row.estado !== 'Negociación'),
    [matrixData.rows, showNegociacion],
  );

  const expandAll = () => {
    setExpandedProjects(new Set(visibleRows.map(r => r.projectId || r.proyecto)));
  };
  const collapseAll = () => {
    setExpandedProjects(new Set());
  };
  const hasTerceroRows = visibleRows.some(r => r.terceroRows?.length > 0);

  const filteredTotals = useMemo(() => {
    const colTotals = {
      presupuestado: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
      ejecutado: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
    };
    let grandTotalPresupuestado = 0;
    let grandTotalEjecutado = 0;
    visibleRows.forEach(r => {
      MONTHS.forEach(m => {
        colTotals.presupuestado[m] += r.presupuestoPorMes[m];
        colTotals.ejecutado[m] += r.ejecucionPorMes[m];
      });
      grandTotalPresupuestado += r.totalPresupuestado;
      grandTotalEjecutado += r.totalEjecutado;
    });
    return { colTotals, grandTotalPresupuestado, grandTotalEjecutado };
  }, [visibleRows]);

  useEffect(() => {
    onReportTotals?.({ presupuestado: filteredTotals.grandTotalPresupuestado, ejecutado: filteredTotals.grandTotalEjecutado });
  }, [filteredTotals, onReportTotals]);

  const getDiferencia = (presupuestado: number, ejecutado: number) => ejecutado - presupuestado;

  const handleCellClick = (proyecto: string, m: Month, presupuestado: number, ejecutado: number, bs: Budget[], ejs: Ejecucion[]) => {
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    onCellClick({
      title: `${proyecto} / ${m}`,
      subtitle: `${mode} de ${tipo}s`,
      formula: `Suma de todas las transacciones de ${tipo} en ${m} para ${proyecto}`,
      budgets: bs || [],
      ejecuciones: ejs || [],
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo,
    });
  };

  const handleRowTotalClick = (proyecto: string, presupuestado: number, ejecutado: number, bs: Budget[], ejs: Ejecucion[]) => {
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    if (value === 0 && bs.length === 0 && ejs.length === 0) return;
    const visibleBs = bs.filter(b => visibleMonths.includes(b.mesPresupuestado));
    const visibleEjs = ejs.filter(e => visibleMonths.includes(getMonthFromDateStr(e.fechaEjecutado)));
    onCellClick({
      title: `Total ${proyecto}`,
      subtitle: `Total del periodo visible`,
      formula: `Suma de los meses visibles para ${proyecto}`,
      budgets: Array.from(new Set(visibleBs)),
      ejecuciones: Array.from(new Set(visibleEjs)),
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo,
    });
  };

  const handleColTotalClick = (m: Month, presupuestado: number, ejecutado: number) => {
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    if (value === 0) return;
    const relevantBs = visibleRows.flatMap(r => r.budgetsPorMes[m]);
    const relevantEjs = visibleRows.flatMap(r => r.ejecucionesPorMes[m]);
    onCellClick({
      title: `Total ${m}`,
      subtitle: `${mode} de ${tipo}s`,
      formula: `Suma de todos los proyectos para ${m}`,
      budgets: Array.from(new Set(relevantBs)),
      ejecuciones: Array.from(new Set(relevantEjs)),
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo,
    });
  };

  const handleGrandTotalClick = () => {
    const p = filteredTotals.grandTotalPresupuestado;
    const e = filteredTotals.grandTotalEjecutado;
    const value = mode === 'Presupuestado' ? p : e;
    if (value === 0) return;
    onCellClick({
      title: `TOTAL PERIODO VISIBLE`,
      subtitle: `${mode} de ${tipo}s`,
      formula: `Suma de toda la matriz visible de ${tipo}s`,
      budgets: Array.from(new Set(matrixData.allMatrixBudgets)),
      ejecuciones: Array.from(new Set(matrixData.allMatrixEjecuciones)),
      value,
      presupuestado: p,
      ejecutado: e,
      diferencia: getDiferencia(p, e),
      mode,
      tipo,
    });
  };

  return (
    <div className={clsx("border rounded-2xl overflow-hidden shadow-sm flex flex-col shrink-0 transition-colors", isP ? "bg-white border-sky-100 shadow-[0_0_15px_-3px_rgba(14,165,233,0.1)]" : "bg-white border-slate-200")}>
      <div className={clsx("p-3 border-b flex items-center justify-between", isP ? "bg-sky-50 border-sky-100" : "bg-slate-800 border-slate-700")}>
        <div className="flex items-center gap-3">
          <h2 className={clsx("text-sm font-bold tracking-tight", isP ? "text-sky-900" : "text-slate-100")}>{title}</h2>
          {hasTerceroRows && (
            <button onClick={() => expandedProjects.size > 0 ? collapseAll() : expandAll()}
              className={clsx("flex items-center gap-2 text-[9px] font-bold uppercase px-2 py-1 rounded border transition-colors", isP ? "text-sky-700 border-sky-200 hover:bg-sky-100 bg-sky-50" : "text-slate-300 border-slate-600 hover:bg-slate-700 bg-slate-700/50")}>
              <span className={clsx("w-7 h-3.5 rounded-full relative transition-colors", expandedProjects.size > 0 ? "bg-indigo-500" : "bg-slate-300")}>
                <span className={clsx("absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all", expandedProjects.size > 0 ? "left-[15px]" : "left-[2px]")} />
              </span>
              Terceros
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className={clsx("border-b", isP ? "bg-sky-50 border-sky-100" : "bg-slate-800 border-slate-700")}>
            <tr>
              <th className={clsx("p-3 text-[10px] font-bold uppercase sticky left-0 z-10 border-r min-w-[240px]", isP ? "text-sky-700 bg-sky-50 border-sky-100" : "text-slate-300 bg-slate-800 border-slate-700")}>Detalle de Proyecto</th>
              {visibleMonths.map(m => {
                const isCurrent = m === currentMonthStr;
                return (<th key={m} className={clsx("p-2 text-[10px] font-bold uppercase text-center border-r min-w-[100px]", isP ? "border-sky-100" : "border-slate-700", isCurrent ? (isP ? "bg-sky-100 text-sky-900" : "bg-slate-700 text-slate-100") : (isP ? "text-sky-700" : "text-slate-400"))}>{m.substring(0,3)}</th>);
              })}
              <th className={clsx("p-3 text-[10px] font-bold uppercase text-right border-l min-w-[120px]", isP ? "text-sky-700 bg-sky-50 border-sky-100" : "text-slate-300 bg-slate-800 border-slate-700")}>Total Período</th>
            </tr>
          </thead>
          <tbody className={clsx("text-[11px] divide-y", isP ? "divide-sky-50" : "divide-slate-100")}>
            {(() => {
              if (visibleRows.length === 0) {
                return <tr><td colSpan={visibleMonths.length + 2} className="p-4 text-center text-slate-500 italic">No hay datos de {tipo}s.</td></tr>;
              }
              const rows: ReactNode[] = [];
              visibleRows.forEach((row) => {
                const rowKey = row.projectId || row.proyecto;
                const isExpanded = expandedProjects.has(rowKey);
                rows.push(
                  <tr key={rowKey} className={clsx("transition-colors group", isP ? "hover:bg-sky-50/40" : "hover:bg-slate-50")}>
                    <td className={clsx("p-3 sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] transition-colors cursor-pointer", isP ? "bg-white group-hover:bg-sky-50/40 border-sky-100" : "bg-white group-hover:bg-slate-50 border-slate-200")}>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); toggleProject(rowKey); }}
                          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span className="font-semibold truncate text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => onProjectClick?.(row.projectId, row.proyecto)}>{row.proyecto}</span>
                        <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0", badgeColors[row.estado] || 'bg-slate-100 text-slate-600')}>{row.estado}</span>
                      </div>
                    </td>
                    {visibleMonths.map(m => {
                      const isCurrent = m === currentMonthStr;
                      const presupuestado = row.presupuestoPorMes[m];
                      const ejecutado = row.ejecucionPorMes[m];
                      const val = mode === 'Presupuestado' ? presupuestado : ejecutado;
                      const isZero = val === 0;
                      return (
                        <td key={m} className={clsx("p-2 text-center border-r transition-colors cursor-pointer", isP ? "border-sky-50" : "border-slate-100", isCurrent && !isZero && (isP ? "bg-sky-50/50" : "bg-indigo-50/30"), !isZero && `font-bold ${hoverBgTheme} ${colorTheme}`, isZero && (isP ? "text-slate-300 hover:bg-sky-50 hover:text-slate-500" : "text-slate-300 hover:bg-slate-50 hover:text-slate-500"))}
                          onClick={() => {
                            if (isZero) {
                              onEmptyCellClick?.(row.projectId, row.proyecto, m, tipo, mode);
                            } else {
                              handleCellClick(row.proyecto, m, presupuestado, ejecutado, row.budgetsPorMes[m] || [], row.ejecucionesPorMes[m] || []);
                            }
                          }}>
                          {isZero ? '-' : formatCurrency(val)}
                        </td>
                      );
                    })}
                    <td className={clsx("p-3 text-right border-l transition-colors font-bold", isP ? "border-sky-100" : "border-slate-200", (mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado) > 0 && `cursor-pointer ${isP ? "hover:bg-sky-50 text-sky-900" : "hover:bg-slate-50 text-slate-800"}`, (mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado) === 0 && "text-slate-400")}
                      onClick={() => handleRowTotalClick(row.proyecto, row.totalPresupuestado, row.totalEjecutado, row.allBudgets, row.allEjecuciones)}>
                      {formatCurrency(mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado)}
                    </td>
                  </tr>
                );

                // Tercero sub-rows
                if (isExpanded && row.terceroRows && row.terceroRows.length > 0) {
                  row.terceroRows.forEach((t, ti) => {
                    const tKey = `${rowKey}-tercero-${t.entityId}-${ti}`;
                    rows.push(
                      <tr key={tKey} className={clsx("transition-colors", isP ? "bg-sky-50/20 hover:bg-sky-50" : "bg-slate-50/40 hover:bg-slate-50")}>
                        <td className={clsx("p-2 pl-8 sticky left-0 z-10 border-r text-[10px]", isP ? "bg-sky-50/20 border-sky-100" : "bg-slate-50/40 border-slate-200")}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-700 truncate">{t.entityName}</span>
                            <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase shrink-0", t.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : t.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : t.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>
                              {t.entityType === 'ambos' ? 'C/P' : t.entityType === 'client' ? 'C' : t.entityType === 'provider' ? 'P' : '?'}
                            </span>
                          </div>
                        </td>
                        {visibleMonths.map(m => {
                          const presupuestado = t.presupuestoPorMes[m];
                          const ejecutado = t.ejecucionPorMes[m];
                          const val = mode === 'Presupuestado' ? presupuestado : ejecutado;
                          const isZero = val === 0;
                          return (
                            <td key={m} className={clsx("p-2 text-center border-r transition-colors text-[10px]", isP ? "border-sky-100" : "border-slate-100", !isZero && `font-semibold ${colorTheme} cursor-pointer ${isP ? "hover:bg-sky-100/50" : "hover:bg-slate-100"}`, isZero && "text-slate-300")}
                              onClick={() => {
                                if (!isZero) {
                                  const bs = t.budgetsPorMes[m] || [];
                                  const ejs = t.ejecucionesPorMes[m] || [];
                                  onCellClick({
                                    title: `${row.proyecto} / ${m}`,
                                    subtitle: `${t.entityName} / ${mode} de ${tipo}s`,
                                    formula: `${t.entityName} en ${m} para ${row.proyecto}`,
                                    budgets: bs,
                                    ejecuciones: ejs,
                                    value: val,
                                    presupuestado,
                                    ejecutado,
                                    diferencia: ejecutado - presupuestado,
                                    mode,
                                    tipo,
                                  });
                                }
                              }}>
                              {isZero ? '-' : formatCurrency(val)}
                            </td>
                          );
                        })}
                        <td className={clsx("p-2 text-right border-l text-[10px] font-semibold", isP ? "border-sky-100" : "border-slate-200", (mode === 'Presupuestado' ? t.totalPresupuestado : t.totalEjecutado) > 0 ? `${colorTheme} cursor-pointer hover:bg-slate-50` : "text-slate-400")}
                          onClick={() => {
                            const p = t.totalPresupuestado;
                            const e = t.totalEjecutado;
                            const val = mode === 'Presupuestado' ? p : e;
                            if (val === 0) return;
                            onCellClick({
                              title: `${row.proyecto} / ${t.entityName}`,
                              subtitle: `Total período / ${mode} de ${tipo}s`,
                              formula: `${t.entityName} en el período visible para ${row.proyecto}`,
                              budgets: t.allBudgets || [],
                              ejecuciones: t.allEjecuciones || [],
                              value: val,
                              presupuestado: p,
                              ejecutado: e,
                              diferencia: e - p,
                              mode,
                              tipo,
                            });
                          }}>
                          {formatCurrency(mode === 'Presupuestado' ? t.totalPresupuestado : t.totalEjecutado)}
                        </td>
                      </tr>
                    );
                  });
                }
              });
              return rows;
            })()}
          </tbody>
          <tfoot className={clsx("font-bold text-[11px]", isP ? "bg-sky-900 text-white" : "bg-slate-900 text-white")}>
            <tr>
              <td className={clsx("p-3 text-xs sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]", isP ? "bg-sky-900 border-sky-800" : "bg-slate-900 border-slate-700")}>TOTAL GENERAL</td>
              {visibleMonths.map(m => {
                const p = filteredTotals.colTotals.presupuestado[m];
                const e = filteredTotals.colTotals.ejecutado[m];
                const val = mode === 'Presupuestado' ? p : e;
                return (<td key={m} className={clsx("p-2 text-center border-r transition-colors", isP ? "border-sky-800" : "border-slate-700", val > 0 && `cursor-pointer ${isP ? "hover:bg-sky-800 text-sky-100" : "hover:bg-slate-800 text-slate-100"}`, val === 0 && (isP ? "text-sky-700" : "text-slate-500"))} onClick={() => handleColTotalClick(m, p, e)}>{val === 0 ? '-' : formatCurrency(val)}</td>);
              })}
              <td className={clsx("p-3 text-right border-l cursor-pointer transition-colors", isP ? "bg-sky-900 border-sky-800 hover:bg-sky-800 text-emerald-300" : "bg-slate-900 border-slate-700 hover:bg-slate-800 text-emerald-400")} onClick={handleGrandTotalClick}>
                {formatCurrency(mode === 'Presupuestado' ? filteredTotals.grandTotalPresupuestado : filteredTotals.grandTotalEjecutado)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, isPercentage }: { label: string; value: number; color: string; isPercentage?: boolean }) {
  const formatted = isPercentage
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
  };
  return (
    <div className={`flex-1 rounded-xl border p-4 ${colorClasses[color] || 'bg-slate-50 border-slate-200 text-slate-800'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-xl font-black mt-1">{formatted}</p>
    </div>
  );
}
