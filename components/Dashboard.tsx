'use client'

import { useState, useMemo } from 'react';
import { SidepanelData, MONTHS, Month, ProjectState, Budget, Ejecucion, TransactionType } from '@/lib/types';
import { ChevronLeft, ChevronRight, Calendar, CalendarRange } from 'lucide-react';
import clsx from 'clsx';

const currentYear = new Date().getFullYear();

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

interface DashboardProps {
  onCellClick: (data: SidepanelData) => void;
  budgets: Budget[];
  ejecuciones: Ejecucion[];
}

const getMonthFromDateStr = (dateString: string): Month => {
  const monthIndex = parseInt(dateString.split('-')[1], 10) - 1;
  return MONTHS[monthIndex];
};

export function Dashboard({ onCellClick, budgets, ejecuciones }: DashboardProps) {
  const [mode, setMode] = useState<'Presupuestado' | 'Ejecutado'>('Presupuestado');
  const [timeView, setTimeView] = useState<'year' | '5months'>('year');
  const [centerMonthIdx, setCenterMonthIdx] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const visibleMonths = useMemo(() => {
    if (timeView === 'year') return MONTHS;
    let start = Math.max(0, centerMonthIdx - 2);
    let end = Math.min(11, start + 4);
    if (end - start < 4) start = Math.max(0, end - 4);
    return MONTHS.slice(start, end + 1);
  }, [timeView, centerMonthIdx]);

  const handlePrevMonth = () => setCenterMonthIdx(prev => Math.max(2, prev - 1));
  const handleNextMonth = () => setCenterMonthIdx(prev => Math.min(9, prev + 1));

  const yearStr = String(selectedYear);
  const filteredBudgets = useMemo(
    () => budgets.filter(b => (b.fechaPresupuestado || '').startsWith(yearStr) || !b.fechaPresupuestado),
    [budgets, yearStr],
  );
  const filteredEjecuciones = useMemo(
    () => ejecuciones.filter(e => e.fechaEjecutado?.startsWith(yearStr)),
    [ejecuciones, yearStr],
  );

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
        </div>
      </header>

      <div className="p-4 flex-1 overflow-auto flex flex-col gap-6">
        <Matrix tipo="ingreso" mode={mode} onCellClick={onCellClick} visibleMonths={visibleMonths} budgets={filteredBudgets} ejecuciones={filteredEjecuciones} />
        <Matrix tipo="egreso" mode={mode} onCellClick={onCellClick} visibleMonths={visibleMonths} budgets={filteredBudgets} ejecuciones={filteredEjecuciones} />
      </div>
    </div>
  );
}

interface MatrixProps {
  tipo: TransactionType;
  mode: 'Presupuestado' | 'Ejecutado';
  onCellClick: (data: SidepanelData) => void;
  visibleMonths: Month[];
  budgets: Budget[];
  ejecuciones: Ejecucion[];
}

function Matrix({ tipo, mode, onCellClick, visibleMonths, budgets, ejecuciones }: MatrixProps) {
  const isP = mode === 'Presupuestado';
  const colorTheme = tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600';
  const hoverBgTheme = tipo === 'ingreso' ? (isP ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-emerald-50/50 hover:text-emerald-700') : (isP ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-rose-50/50 hover:text-rose-700');
  const currentMonthIdx = new Date().getMonth();
  const currentMonthStr = MONTHS[currentMonthIdx];

  const matrixData = useMemo(() => {
    const projectsMap = new Map<string, {
      cliente: string;
      estado: ProjectState;
      presupuestoPorMes: Record<Month, number>;
      ejecucionPorMes: Record<Month, number>;
      budgetsPorMes: Record<Month, Budget[]>;
      ejecucionesPorMes: Record<Month, Ejecucion[]>;
      allBudgets: Budget[];
      allEjecuciones: Ejecucion[];
    }>();

    const relevantBudgets = budgets.filter(b => b.tipo === tipo);
    const relevantEjecuciones = ejecuciones.filter(e => e.tipo === tipo);

    relevantBudgets.forEach(b => {
      if (!projectsMap.has(b.proyectoAsignado)) {
        projectsMap.set(b.proyectoAsignado, {
          cliente: b.clienteOProveedor,
          estado: b.estadoProyecto,
          presupuestoPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
          ejecucionPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
          budgetsPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>,
          ejecucionesPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>,
          allBudgets: [],
          allEjecuciones: [],
        });
      }
      const pd = projectsMap.get(b.proyectoAsignado)!;
      pd.allBudgets.push(b);
      pd.presupuestoPorMes[b.mesPresupuestado] += b.montoPresupuestado;
      pd.budgetsPorMes[b.mesPresupuestado].push(b);
    });

    relevantEjecuciones.forEach(e => {
      if (!projectsMap.has(e.proyectoAsignado)) {
        projectsMap.set(e.proyectoAsignado, {
          cliente: e.clienteOProveedor,
          estado: 'Activo' as ProjectState,
          presupuestoPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
          ejecucionPorMes: Object.fromEntries(MONTHS.map(m => [m, 0])) as Record<Month, number>,
          budgetsPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Budget[]])) as Record<Month, Budget[]>,
          ejecucionesPorMes: Object.fromEntries(MONTHS.map(m => [m, [] as Ejecucion[]])) as Record<Month, Ejecucion[]>,
          allBudgets: [],
          allEjecuciones: [],
        });
      }
      const pd = projectsMap.get(e.proyectoAsignado)!;
      pd.allEjecuciones.push(e);
      const ejMonth = getMonthFromDateStr(e.fechaEjecutado);
      pd.ejecucionPorMes[ejMonth] += e.montoEjecutado;
      pd.ejecucionesPorMes[ejMonth].push(e);
    });

    const rows = Array.from(projectsMap.entries()).map(([proyecto, data]) => {
      const totalPresupuestado = visibleMonths.reduce((sum, m) => sum + data.presupuestoPorMes[m], 0);
      const totalEjecutado = visibleMonths.reduce((sum, m) => sum + data.ejecucionPorMes[m], 0);
      return { proyecto, ...data, totalPresupuestado, totalEjecutado };
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
  }, [tipo, visibleMonths, budgets, ejecuciones]);

  const badgeColors: Record<string, string> = {
    'Activo': isP ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-100 text-emerald-700',
    'Cerrado': isP ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-600',
    'Negociación': isP ? 'bg-orange-100 text-orange-800' : 'bg-orange-100 text-orange-700',
    'En ejecución': isP ? 'bg-blue-100 text-blue-800' : 'bg-blue-100 text-blue-700',
    'Cancelado': isP ? 'bg-red-100 text-red-800' : 'bg-red-100 text-red-700'
  };

  const title = `${tipo.toUpperCase()}S ${mode.toUpperCase()}S`;

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
    const relevantBs = matrixData.rows.flatMap(r => r.budgetsPorMes[m]);
    const relevantEjs = matrixData.rows.flatMap(r => r.ejecucionesPorMes[m]);
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
    const p = matrixData.grandTotalPresupuestado;
    const e = matrixData.grandTotalEjecutado;
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
        <h2 className={clsx("text-sm font-bold tracking-tight", isP ? "text-sky-900" : "text-slate-100")}>{title}</h2>
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
            {matrixData.rows.length === 0 ? (
              <tr><td colSpan={visibleMonths.length + 2} className="p-4 text-center text-slate-500 italic">No hay datos de {tipo}s.</td></tr>
            ) : (
              matrixData.rows.map((row) => (
                <tr key={row.proyecto} className={clsx("transition-colors group", isP ? "hover:bg-sky-50/40" : "hover:bg-slate-50")}>
                  <td className={clsx("p-3 sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] transition-colors", isP ? "bg-white group-hover:bg-sky-50/40 border-sky-100" : "bg-white group-hover:bg-slate-50 border-slate-200")}>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold truncate text-slate-800">{row.proyecto}</span>
                      <span className="text-[10px] truncate text-slate-500">{row.cliente}</span>
                      <div><span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", badgeColors[row.estado] || 'bg-slate-100 text-slate-600')}>{row.estado}</span></div>
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
                        onClick={() => handleCellClick(row.proyecto, m, presupuestado, ejecutado, row.budgetsPorMes[m] || [], row.ejecucionesPorMes[m] || [])}>
                        {isZero ? '-' : formatCurrency(val)}
                      </td>
                    );
                  })}
                  <td className={clsx("p-3 text-right border-l transition-colors font-bold", isP ? "border-sky-100" : "border-slate-200", (mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado) > 0 && `cursor-pointer ${isP ? "hover:bg-sky-50 text-sky-900" : "hover:bg-slate-50 text-slate-800"}`, (mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado) === 0 && "text-slate-400")}
                    onClick={() => handleRowTotalClick(row.proyecto, row.totalPresupuestado, row.totalEjecutado, row.allBudgets, row.allEjecuciones)}>
                    {formatCurrency(mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className={clsx("font-bold text-[11px]", isP ? "bg-sky-900 text-white" : "bg-slate-900 text-white")}>
            <tr>
              <td className={clsx("p-3 text-xs sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]", isP ? "bg-sky-900 border-sky-800" : "bg-slate-900 border-slate-700")}>TOTAL GENERAL</td>
              {visibleMonths.map(m => {
                const p = matrixData.colTotals.presupuestado[m];
                const e = matrixData.colTotals.ejecutado[m];
                const val = mode === 'Presupuestado' ? p : e;
                return (<td key={m} className={clsx("p-2 text-center border-r transition-colors", isP ? "border-sky-800" : "border-slate-700", val > 0 && `cursor-pointer ${isP ? "hover:bg-sky-800 text-sky-100" : "hover:bg-slate-800 text-slate-100"}`, val === 0 && (isP ? "text-sky-700" : "text-slate-500"))} onClick={() => handleColTotalClick(m, p, e)}>{val === 0 ? '-' : formatCurrency(val)}</td>);
              })}
              <td className={clsx("p-3 text-right border-l cursor-pointer transition-colors", isP ? "bg-sky-900 border-sky-800 hover:bg-sky-800 text-emerald-300" : "bg-slate-900 border-slate-700 hover:bg-slate-800 text-emerald-400")} onClick={handleGrandTotalClick}>
                {formatCurrency(mode === 'Presupuestado' ? matrixData.grandTotalPresupuestado : matrixData.grandTotalEjecutado)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
