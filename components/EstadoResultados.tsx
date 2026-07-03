'use client'

import { useState, useMemo, Fragment } from 'react';
import { Budget, Ejecucion, Project } from '@/lib/types';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import clsx from 'clsx';

export interface PnLRow {
  id: string;
  label: string;
  value: number;
  editable: boolean;
  indent: number;
  bold: boolean;
  children?: { projectName: string; value: number; estado?: string }[];
}

interface PnLRecord {
  projectName: string;
  projectId?: string;
  tipo: 'ingreso' | 'egreso';
  montoPresupuestado: number;
  montoEjecutado: number;
  estado?: string;
}

const currentYear = new Date().getFullYear();

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const formatPercent = (val: number) =>
  `${val.toFixed(1)}%`;

function isAdminProject(name: string): boolean {
  return name.trim().toLowerCase() === 'admin';
}

/**
 * Groups records by project for breakdown display.
 */
function groupByProject(
  records: PnLRecord[],
  getMonto: (r: PnLRecord) => number,
): { projectName: string; value: number; estado?: string }[] {
  const map = new Map<string, { projectName: string; value: number; estado?: string }>();
  for (const r of records) {
    const key = r.projectId || r.projectName;
    const entry = map.get(key);
    if (entry) {
      entry.value += getMonto(r);
    } else {
      map.set(key, { projectName: r.projectName, value: getMonto(r), estado: r.estado });
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/** Colores de badge por estado (consistentes con Dashboard) */
const badgeColors: Record<string, string> = {
  'Activo': 'bg-emerald-100 text-emerald-700',
  'Negociación': 'bg-amber-100 text-amber-700',
  'Finalizado': 'bg-slate-200 text-slate-600',
  'En ejecución': 'bg-sky-100 text-sky-700',
  'Pausado': 'bg-rose-100 text-rose-700',
};

export function computePnL(
  records: PnLRecord[],
  mode: 'Presupuestado' | 'Ejecutado',
  devoluciones: number,
  gastosFinancieros: number,
): PnLRow[] {
  const isPresupuestado = mode === 'Presupuestado';
  const getMonto = (r: PnLRecord): number =>
    isPresupuestado ? r.montoPresupuestado : r.montoEjecutado;

  // F1: Ingresos (all projects)
  const ingresosRecords = records.filter(r => r.tipo === 'ingreso');
  const F1 = ingresosRecords.reduce((sum, r) => sum + getMonto(r), 0);
  const F1Children = groupByProject(ingresosRecords, getMonto);

  const F2 = devoluciones;
  const F3 = F1 - F2;

  // F4: Costos (non-Admin projects)
  const costosRecords = records.filter(r => r.tipo === 'egreso' && !isAdminProject(r.projectName));
  const F4 = costosRecords.reduce((sum, r) => sum + getMonto(r), 0);
  const F4Children = groupByProject(costosRecords, getMonto);

  const F5 = F3 - F4;

  // F6: Gastos Admin
  const adminRecords = records.filter(r => r.tipo === 'egreso' && isAdminProject(r.projectName));
  const F6 = adminRecords.reduce((sum, r) => sum + getMonto(r), 0);

  const F7 = gastosFinancieros;
  const F8 = (F4 + F6 + F7) * 0.004;
  const F9 = F5 - F6 - F7 - F8;
  const F10 = F1 * 0.081;
  const F11 = Math.min(F8, F10);
  const F12 = F9 - F10 + F11;

  return [
    { id: 'F1',  label: 'Ingresos Brutos Operacionales', value: F1,  editable: false, indent: 0, bold: false, children: F1Children },
    { id: 'F2',  label: 'Devoluciones, rebajas y descuentos', value: F2,  editable: true,  indent: 1, bold: false },
    { id: 'F3',  label: 'Ingresos Netos',                   value: F3,  editable: false, indent: 1, bold: true  },
    { id: 'F4',  label: 'Costos de Operación',              value: F4,  editable: false, indent: 0, bold: false, children: F4Children },
    { id: 'F5',  label: 'Utilidad Bruta',                   value: F5,  editable: false, indent: 1, bold: true  },
    { id: 'F6',  label: 'Gastos Administrativos',           value: F6,  editable: false, indent: 0, bold: false },
    { id: 'F7',  label: 'Gastos Financieros',               value: F7,  editable: true,  indent: 1, bold: false },
    { id: 'F8',  label: 'GMF (4×1000)',                     value: F8,  editable: false, indent: 1, bold: false },
    { id: 'F9',  label: 'Utilidad Operacional',             value: F9,  editable: false, indent: 1, bold: true  },
    { id: 'F10', label: 'Impuesto SIMPLE (8.1%)',           value: F10, editable: false, indent: 0, bold: false },
    { id: 'F11', label: 'Descuento Tributario GMF',         value: F11, editable: false, indent: 1, bold: false },
    { id: 'F12', label: 'Utilidad Neta del Ejercicio',      value: F12, editable: false, indent: 0, bold: true  },
  ];
}

interface EstadoResultadosProps {
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  projects?: Project[];
}

function KpiCard({ label, value, isPercent = false, color, mode }: {
  label: string;
  value: number;
  isPercent?: boolean;
  color: 'emerald' | 'rose' | 'indigo';
  mode: 'Presupuestado' | 'Ejecutado';
}) {
  const isP = mode === 'Presupuestado';
  const colorMap: Record<string, string> = {
    emerald: isP ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-800 border-slate-700 text-emerald-300',
    rose:    isP ? 'bg-rose-50 border-rose-200 text-rose-800'          : 'bg-slate-800 border-slate-700 text-rose-300',
    indigo:  isP ? 'bg-indigo-50 border-indigo-200 text-indigo-800'    : 'bg-slate-800 border-slate-700 text-indigo-300',
  };
  return (
    <div className={clsx("rounded-xl p-4 border flex-1", colorMap[color])}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-1 font-mono">
        {isPercent ? formatPercent(value) : formatCurrency(value)}
      </p>
    </div>
  );
}

export function EstadoResultados({ budgets, ejecuciones, projects }: EstadoResultadosProps) {
  const [mode, setMode] = useState<'Presupuestado' | 'Ejecutado'>('Presupuestado');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [devoluciones, setDevoluciones] = useState<number>(0);
  const [gastosFinancieros, setGastosFinancieros] = useState<number>(0);
  const [showNegociacion, setShowNegociacion] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isP = mode === 'Presupuestado';
  const yearStr = String(selectedYear);

  // Build project lookup for estado
  const projectMap = useMemo(() => {
    if (!projects) return new Map<string, Project>();
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id || p.name, p));
    return map;
  }, [projects]);

  // Build set of Negociacion project IDs
  const negociacionProjectIds = useMemo(() => {
    if (!projects) return new Set<string>();
    return new Set(projects.filter(p => p.estado === 'Negociación').map(p => p.id || p.name));
  }, [projects]);

  const filteredRecords = useMemo(() => {
    const records = mode === 'Presupuestado' ? budgets : ejecuciones;
    return records.filter(r => {
      const fecha =
        mode === 'Presupuestado'
          ? (r as Budget).fechaPresupuestado
          : (r as Ejecucion).fechaEjecutado;
      if (!(fecha || '').startsWith(yearStr)) return false;
      if ((r as { archivado?: boolean }).archivado === true) return false;
      if (!showNegociacion) {
        const pid = r.projectId || r.projectName;
        if (negociacionProjectIds.has(pid)) return false;
      }
      return true;
    });
  }, [budgets, ejecuciones, mode, yearStr, showNegociacion, negociacionProjectIds]);

  const recordsForPnL: PnLRecord[] = useMemo(
    () =>
      filteredRecords.map(r => ({
        projectName: r.projectName,
        projectId: r.projectId,
        tipo: r.tipo,
        montoPresupuestado: (r as Budget).montoPresupuestado ?? 0,
        montoEjecutado: (r as Ejecucion).montoEjecutado ?? 0,
        estado: projectMap.get(r.projectId || r.projectName)?.estado,
      })),
    [filteredRecords, projectMap],
  );

  const rows = useMemo(
    () => computePnL(recordsForPnL, mode, devoluciones, gastosFinancieros),
    [recordsForPnL, mode, devoluciones, gastosFinancieros],
  );

  // KPI values
  const utilidadBruta = rows.find(r => r.id === 'F5')?.value ?? 0;
  const utilidadNeta = rows.find(r => r.id === 'F12')?.value ?? 0;
  const ingresosNetos = rows.find(r => r.id === 'F3')?.value ?? 0;
  const margen = ingresosNetos > 0 ? (utilidadBruta / ingresosNetos) * 100 : 0;

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleF2Change = (val: string) => {
    const n = Number(val);
    if (!isNaN(n)) setDevoluciones(n);
  };

  const handleF7Change = (val: string) => {
    const n = Number(val);
    if (!isNaN(n)) setGastosFinancieros(n);
  };

  // Theme classes
  const containerBg = isP ? 'bg-sky-50/30' : 'bg-slate-50';
  const tableHeaderBg = isP ? 'bg-sky-50 border-sky-100' : 'bg-slate-800 border-slate-700';
  const tableHeaderText = isP ? 'text-sky-700' : 'text-slate-300';
  const boldRowBg = isP ? 'bg-sky-50/50' : 'bg-slate-50';
  const subRowBg = isP ? 'bg-sky-50/20' : 'bg-slate-50/50';

  return (
    <div className={clsx("flex-1 flex flex-col min-w-0 h-full transition-colors", containerBg)}>
      {/* Header */}
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-white border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Estado de Resultados</h1>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-500">Profit &amp; Loss — Régimen Simple de Tributación</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border p-1 rounded-lg bg-slate-100 border-slate-200">
            <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-white transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 text-xs font-bold text-slate-700 min-w-[48px] text-center select-none">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-white transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="p-1 rounded-lg flex border bg-slate-100 border-slate-200">
            <button className={clsx("px-4 py-1 text-xs font-bold rounded-md transition-colors", isP ? "bg-sky-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setMode('Presupuestado')}>Presupuestado</button>
            <button className={clsx("px-4 py-1 text-xs font-bold rounded-md transition-colors", !isP ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setMode('Ejecutado')}>Ejecutado</button>
          </div>
          <button onClick={() => setShowNegociacion(prev => !prev)}
            className={clsx("px-3 py-1 text-[10px] font-bold rounded-lg border transition-colors", showNegociacion ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-100 text-slate-500 border-slate-200")}>
            Negociación {showNegociacion ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="px-6 pt-4 flex gap-4 shrink-0">
        <KpiCard label="Ingresos Netos" value={ingresosNetos} mode={mode} color="emerald" />
        <KpiCard label="Utilidad Bruta" value={utilidadBruta} mode={mode} color={utilidadBruta >= 0 ? 'emerald' : 'rose'} />
        <KpiCard label="Utilidad Neta" value={utilidadNeta} mode={mode} color={utilidadNeta >= 0 ? 'emerald' : 'rose'} />
        <KpiCard label="Margen Bruto" value={margen} isPercent mode={mode} color="indigo" />
      </div>

      {/* P&L Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className={clsx("border-b-2", tableHeaderBg)}>
                <th className={clsx("text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider w-16", tableHeaderText)}>Cód</th>
                <th className={clsx("text-left py-3 px-4 text-[11px] font-bold uppercase tracking-wider", tableHeaderText)}>Concepto</th>
                <th className={clsx("text-right py-3 px-4 text-[11px] font-bold uppercase tracking-wider w-52", tableHeaderText)}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const hasChildren = row.children && row.children.length > 0;
                const isExpanded = expandedRows.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={clsx(
                        'border-b border-slate-100 transition-colors',
                        row.bold && boldRowBg,
                        hasChildren && 'cursor-pointer hover:bg-slate-50',
                      )}
                      onClick={() => hasChildren && toggleRow(row.id)}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1">
                          {hasChildren && (
                            <span className="text-slate-400">
                              {isExpanded ? <ChevronDown size={12} /> : <ChevronRightIcon size={12} />}
                            </span>
                          )}
                          <span className={clsx(
                            'text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded',
                            row.bold ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500',
                          )}>{row.id}</span>
                        </div>
                      </td>
                      <td className={clsx(
                        'py-2.5 px-4 text-[11px]',
                        row.bold ? 'font-bold text-slate-800' : 'text-slate-600',
                      )} style={{ paddingLeft: `${12 + row.indent * 20}px` }}>
                        {row.label}
                        {hasChildren && (
                          <span className="text-[10px] text-slate-400 ml-1">({row.children!.length} proyectos)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {row.editable ? (
                          <input type="number"
                            value={row.id === 'F2' ? (devoluciones || '') : (gastosFinancieros || '')}
                            onChange={e => row.id === 'F2' ? handleF2Change(e.target.value) : handleF7Change(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full text-right text-[11px] font-mono px-2 py-1 rounded border bg-yellow-50 border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-slate-700"
                            placeholder="0"
                          />
                        ) : (
                          <span className={clsx('text-[11px] font-mono', row.bold ? 'font-bold text-slate-800' : 'text-slate-600')}>
                            {formatCurrency(row.value)}
                          </span>
                        )}
                      </td>
                    </tr>
                    {/* Project breakdown sub-rows */}
                    {hasChildren && isExpanded && row.children!.map(child => (
                      <tr key={child.projectName} className={clsx("border-b border-slate-50", subRowBg)}>
                        <td className="py-1.5 px-4"></td>
                        <td className="py-1.5 px-4">
                          <div className="flex items-center gap-2 ml-6">
                            <span className="text-[11px] text-slate-500">└ {child.projectName}</span>
                            {child.estado && (
                              <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", badgeColors[child.estado] || 'bg-slate-100 text-slate-600')}>
                                {child.estado}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-4 text-right">
                          <span className="text-[11px] font-mono text-slate-500">{formatCurrency(child.value)}</span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
