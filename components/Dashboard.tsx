'use client'

import { useState, useMemo } from 'react';
import { SidepanelData, MONTHS, Month, ProjectState, Transaction, TransactionType } from '@/lib/types';
import { ChevronLeft, ChevronRight, Calendar, CalendarRange } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

interface DashboardProps {
  onCellClick: (data: SidepanelData) => void;
  transactions: Transaction[];
}

const getMonthFromDateStr = (dateString: string): Month => {
  const monthIndex = parseInt(dateString.split('-')[1], 10) - 1;
  return MONTHS[monthIndex];
}

export function Dashboard({ onCellClick, transactions }: DashboardProps) {
  const [mode, setMode] = useState<'Presupuestado' | 'Ejecutado'>('Presupuestado');
  const [timeView, setTimeView] = useState<'year' | '5months'>('year');
  const [centerMonthIdx, setCenterMonthIdx] = useState<number>(new Date().getMonth());

  const visibleMonths = useMemo(() => {
    if (timeView === 'year') return MONTHS;
    
    let start = Math.max(0, centerMonthIdx - 2);
    let end = Math.min(11, start + 4);
    if (end - start < 4) {
      start = Math.max(0, end - 4);
    }
    return MONTHS.slice(start, end + 1);
  }, [timeView, centerMonthIdx]);

  const handlePrevMonth = () => setCenterMonthIdx(prev => Math.max(2, prev - 1));
  const handleNextMonth = () => setCenterMonthIdx(prev => Math.min(9, prev + 1));

  return (
    <div className={clsx("flex-1 flex flex-col min-w-0 h-full transition-colors", mode === 'Presupuestado' ? "bg-sky-50/30" : "bg-slate-50")}>
      <header className={clsx("h-14 border-b px-6 flex items-center justify-between shrink-0 transition-colors", mode === 'Presupuestado' ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200")}>
        <div>
          <h1 className={clsx("text-lg font-semibold", mode === 'Presupuestado' ? "text-sky-900" : "text-slate-800")}>Dashboard Presupuestal</h1>
          <p className={clsx("text-[10px] uppercase tracking-wider font-medium", mode === 'Presupuestado' ? "text-sky-600" : "text-slate-500")}>Matriz de control de Ingresos y Egresos</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={clsx("flex items-center gap-2 border p-1 rounded-lg transition-colors", mode === 'Presupuestado' ? "bg-sky-100/50 border-sky-200" : "bg-slate-100 border-slate-200")}>
            <button 
              onClick={() => setTimeView('year')}
              className={clsx("p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors", timeView === 'year' ? (mode === 'Presupuestado' ? 'bg-white shadow-sm text-sky-700' : 'bg-white shadow-sm text-slate-700') : (mode === 'Presupuestado' ? 'text-sky-700/60 hover:text-sky-900' : 'text-slate-500 hover:text-slate-700'))}
              title="Vista del Año"
            >
              <Calendar size={14} /> Año
            </button>
            <button 
              onClick={() => setTimeView('5months')}
              className={clsx("p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors", timeView === '5months' ? (mode === 'Presupuestado' ? 'bg-white shadow-sm text-sky-700' : 'bg-white shadow-sm text-slate-700') : (mode === 'Presupuestado' ? 'text-sky-700/60 hover:text-sky-900' : 'text-slate-500 hover:text-slate-700'))}
              title="Vista de 5 Meses"
            >
              <CalendarRange size={14} /> 5 Meses
            </button>
            {timeView === '5months' && (
              <div className={clsx("flex items-center ml-1 border-l pl-1", mode === 'Presupuestado' ? "border-sky-200" : "border-slate-200")}>
                <button onClick={handlePrevMonth} disabled={centerMonthIdx <= 2} className={clsx("p-1 disabled:opacity-30", mode === 'Presupuestado' ? "text-sky-600 hover:text-sky-800" : "text-slate-400 hover:text-slate-600")}><ChevronLeft size={16}/></button>
                <button onClick={handleNextMonth} disabled={centerMonthIdx >= 9} className={clsx("p-1 disabled:opacity-30", mode === 'Presupuestado' ? "text-sky-600 hover:text-sky-800" : "text-slate-400 hover:text-slate-600")}><ChevronRight size={16}/></button>
              </div>
            )}
          </div>

          <div className={clsx("p-1 rounded-lg flex border transition-colors", mode === 'Presupuestado' ? "bg-sky-100 border-sky-200" : "bg-slate-200 border-slate-300")}>
            <button
              className={clsx("px-4 py-1 text-xs font-bold rounded-md transition-colors", mode === 'Presupuestado' ? "bg-sky-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setMode('Presupuestado')}
            >
              Presupuestado
            </button>
            <button
              className={clsx("px-4 py-1 text-xs font-bold rounded-md transition-colors", mode === 'Ejecutado' ? "bg-slate-800 text-white shadow-sm" : "text-sky-700/70 hover:text-sky-900")}
              onClick={() => setMode('Ejecutado')}
            >
              Ejecutado
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 flex-1 overflow-auto flex flex-col gap-6">
        <Matrix tipo="ingreso" mode={mode} onCellClick={onCellClick} visibleMonths={visibleMonths} transactions={transactions} />
        <Matrix tipo="egreso" mode={mode} onCellClick={onCellClick} visibleMonths={visibleMonths} transactions={transactions} />
      </div>
    </div>
  );
}

interface MatrixProps {
  tipo: TransactionType;
  mode: 'Presupuestado' | 'Ejecutado';
  onCellClick: (data: SidepanelData) => void;
  visibleMonths: Month[];
  transactions: Transaction[];
}

function Matrix({ tipo, mode, onCellClick, visibleMonths, transactions }: MatrixProps) {
  const isP = mode === 'Presupuestado';
  const colorTheme = tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600';
  const hoverBgTheme = tipo === 'ingreso' ? (isP ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-emerald-50/50 hover:text-emerald-700') : (isP ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-rose-50/50 hover:text-rose-700');
  const currentMonthIdx = new Date().getMonth();
  const currentMonthStr = MONTHS[currentMonthIdx];

  const matrixData = useMemo(() => {
    const projectsMap = new Map<string, {
      cliente: string;
      estado: ProjectState;
      meses: {
        presupuestado: Record<Month, number>;
        ejecutado: Record<Month, number>;
      };
      transactions: Record<Month, Transaction[]>; // Keeping it simple: all relevant txs for the month
      allTransactions: Transaction[];
    }>();

    const relevantTxs = transactions.filter(t => t.tipo === tipo);

    relevantTxs.forEach(tx => {
      if (!projectsMap.has(tx.proyectoAsignado)) {
        projectsMap.set(tx.proyectoAsignado, {
          cliente: tx.clienteOProveedor,
          estado: tx.estadoProyecto,
          meses: {
            presupuestado: Object.fromEntries(MONTHS.map(m => [m, 0])) as unknown as Record<Month, number>,
            ejecutado: Object.fromEntries(MONTHS.map(m => [m, 0])) as unknown as Record<Month, number>,
          },
          transactions: Object.fromEntries(MONTHS.map(m => [m, []])) as unknown as Record<Month, Transaction[]>,
          allTransactions: []
        });
      }

      const pData = projectsMap.get(tx.proyectoAsignado)!;
      pData.allTransactions.push(tx);

      // Add to Presupuestado
      pData.meses.presupuestado[tx.mesPresupuestado] += tx.montoPresupuestado;
      if (!pData.transactions[tx.mesPresupuestado].includes(tx)) {
        pData.transactions[tx.mesPresupuestado].push(tx);
      }

      // Add to Ejecutado
      tx.ejecuciones.forEach(ej => {
        const ejMonth = getMonthFromDateStr(ej.fechaEjecutado);
        pData.meses.ejecutado[ejMonth] += ej.montoEjecutado;
        if (!pData.transactions[ejMonth].includes(tx)) {
          pData.transactions[ejMonth].push(tx);
        }
      });
    });

    const rows = Array.from(projectsMap.entries()).map(([proyecto, data]) => {
      const totalPresupuestado = visibleMonths.reduce((sum, m) => sum + data.meses.presupuestado[m], 0);
      const totalEjecutado = visibleMonths.reduce((sum, m) => sum + data.meses.ejecutado[m], 0);
      return { proyecto, ...data, totalPresupuestado, totalEjecutado };
    });

    const colTotals = {
      presupuestado: Object.fromEntries(MONTHS.map(m => [m, 0])) as unknown as Record<Month, number>,
      ejecutado: Object.fromEntries(MONTHS.map(m => [m, 0])) as unknown as Record<Month, number>,
    };
    let grandTotalPresupuestado = 0;
    let grandTotalEjecutado = 0;
    let allMatrixTransactions: Transaction[] = [];

    rows.forEach(r => {
      MONTHS.forEach(m => {
        colTotals.presupuestado[m] += r.meses.presupuestado[m];
        colTotals.ejecutado[m] += r.meses.ejecutado[m];
      });
      grandTotalPresupuestado += r.totalPresupuestado;
      grandTotalEjecutado += r.totalEjecutado;
      
      const rowVisibleTxs = visibleMonths.flatMap(m => r.transactions[m]);
      allMatrixTransactions = [...allMatrixTransactions, ...rowVisibleTxs];
    });

    return { rows, colTotals, grandTotalPresupuestado, grandTotalEjecutado, allMatrixTransactions };
  }, [tipo, visibleMonths]);

  const badgeColors: Record<ProjectState, string> = {
    'Activo': isP ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-100 text-emerald-700',
    'Cerrado': isP ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-600',
    'Negociación': isP ? 'bg-orange-100 text-orange-800' : 'bg-orange-100 text-orange-700'
  };

  const title = `${tipo.toUpperCase()}S ${mode.toUpperCase()}S`;

  const getDiferencia = (presupuestado: number, ejecutado: number) => {
    return ejecutado - presupuestado;
  };

  const handleCellClick = (proyecto: string, m: Month, presupuestado: number, ejecutado: number, txs: Transaction[]) => {
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    onCellClick({
      title: `${proyecto} / ${m}`,
      subtitle: `${mode} de ${tipo}s`,
      formula: `Suma de todas las transacciones de ${tipo} en ${m} para ${proyecto}`,
      transactions: txs || [],
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo
    });
  };

  const handleRowTotalClick = (proyecto: string, presupuestado: number, ejecutado: number, txs: Transaction[]) => {
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    if (value === 0 && txs.length === 0) return;
    
    // Filter txs to visible months
    const visibleTxs = txs.filter(t => 
      visibleMonths.includes(t.mesPresupuestado) || t.ejecuciones.some(ej => visibleMonths.includes(getMonthFromDateStr(ej.fechaEjecutado)))
    );

    onCellClick({
      title: `Total ${proyecto}`,
      subtitle: `Total del periodo visible`,
      formula: `Suma de los meses visibles para ${proyecto}`,
      transactions: Array.from(new Set(visibleTxs)),
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo
    });
  };

  const handleColTotalClick = (m: Month, presupuestado: number, ejecutado: number) => {
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    if (value === 0) return;
    
    const relevantTxs = matrixData.rows.flatMap(r => r.transactions[m]);
    onCellClick({
      title: `Total ${m}`,
      subtitle: `${mode} de ${tipo}s`,
      formula: `Suma de todos los proyectos para ${m}`,
      transactions: Array.from(new Set(relevantTxs)),
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo
    });
  };

  const handleGrandTotalClick = () => {
    const presupuestado = matrixData.grandTotalPresupuestado;
    const ejecutado = matrixData.grandTotalEjecutado;
    const value = mode === 'Presupuestado' ? presupuestado : ejecutado;
    if (value === 0) return;
    onCellClick({
      title: `TOTAL PERIODO VISIBLE`,
      subtitle: `${mode} de ${tipo}s`,
      formula: `Suma de toda la matriz visible de ${tipo}s`,
      transactions: Array.from(new Set(matrixData.allMatrixTransactions)),
      value,
      presupuestado,
      ejecutado,
      diferencia: getDiferencia(presupuestado, ejecutado),
      mode,
      tipo
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
                return (
                  <th key={m} className={clsx("p-2 text-[10px] font-bold uppercase text-center border-r min-w-[100px]", isP ? "border-sky-100" : "border-slate-700", isCurrent ? (isP ? "bg-sky-100 text-sky-900" : "bg-slate-700 text-slate-100") : (isP ? "text-sky-700" : "text-slate-400"))}>
                    {m.substring(0,3)}
                  </th>
                );
              })}
              <th className={clsx("p-3 text-[10px] font-bold uppercase text-right border-l min-w-[120px]", isP ? "text-sky-700 bg-sky-50 border-sky-100" : "text-slate-300 bg-slate-800 border-slate-700")}>Total Período</th>
            </tr>
          </thead>
          <tbody className={clsx("text-[11px] divide-y", isP ? "divide-sky-50" : "divide-slate-100")}>
            {matrixData.rows.length === 0 ? (
              <tr>
                <td colSpan={visibleMonths.length + 2} className="p-4 text-center text-slate-500 italic">No hay datos de {tipo}s.</td>
              </tr>
            ) : (
              matrixData.rows.map((row) => (
                <tr key={row.proyecto} className={clsx("transition-colors group", isP ? "hover:bg-sky-50/40" : "hover:bg-slate-50")}>
                  <td className={clsx("p-3 sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] transition-colors", isP ? "bg-white group-hover:bg-sky-50/40 border-sky-100" : "bg-white group-hover:bg-slate-50 border-slate-200")}>
                    <div className="flex flex-col gap-1">
                      <span className={clsx("font-semibold truncate", "text-slate-800")}>{row.proyecto}</span>
                      <span className={clsx("text-[10px] truncate", "text-slate-500")}>{row.cliente}</span>
                      <div>
                        <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", badgeColors[row.estado])}>
                          {row.estado}
                        </span>
                      </div>
                    </div>
                  </td>
                  {visibleMonths.map(m => {
                    const isCurrent = m === currentMonthStr;
                    const presupuestado = row.meses.presupuestado[m];
                    const ejecutado = row.meses.ejecutado[m];
                    const val = mode === 'Presupuestado' ? presupuestado : ejecutado;
                    const isZero = val === 0;
                    return (
                      <td 
                        key={m} 
                        className={clsx(
                          "p-2 text-center border-r transition-colors cursor-pointer",
                          isP ? "border-sky-50" : "border-slate-100",
                          isCurrent && !isZero && (isP ? "bg-sky-50/50" : "bg-indigo-50/30"),
                          !isZero && `font-bold ${hoverBgTheme} ${colorTheme}`,
                          isZero && (isP ? "text-slate-300 hover:bg-sky-50 hover:text-slate-500" : "text-slate-300 hover:bg-slate-50 hover:text-slate-500")
                        )}
                        onClick={() => handleCellClick(row.proyecto, m, presupuestado, ejecutado, row.transactions[m] || [])}
                      >
                        {isZero ? '-' : formatCurrency(val)}
                      </td>
                    );
                  })}
                  <td 
                    className={clsx(
                      "p-3 text-right border-l transition-colors font-bold",
                      isP ? "border-sky-100" : "border-slate-200",
                      (mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado) > 0 && `cursor-pointer ${isP ? "hover:bg-sky-50 text-sky-900" : "hover:bg-slate-50 text-slate-800"}`,
                      (mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado) === 0 && "text-slate-400"
                    )}
                    onClick={() => handleRowTotalClick(row.proyecto, row.totalPresupuestado, row.totalEjecutado, row.allTransactions)}
                  >
                    {formatCurrency(mode === 'Presupuestado' ? row.totalPresupuestado : row.totalEjecutado)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className={clsx("font-bold text-[11px]", isP ? "bg-sky-900 text-white" : "bg-slate-900 text-white")}>
            <tr>
              <td className={clsx("p-3 text-xs sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]", isP ? "bg-sky-900 border-sky-800" : "bg-slate-900 border-slate-700")}>
                TOTAL GENERAL
              </td>
              {visibleMonths.map(m => {
                const presupuestado = matrixData.colTotals.presupuestado[m];
                const ejecutado = matrixData.colTotals.ejecutado[m];
                const val = mode === 'Presupuestado' ? presupuestado : ejecutado;
                return (
                  <td 
                    key={m} 
                    className={clsx(
                      "p-2 text-center border-r transition-colors",
                      isP ? "border-sky-800" : "border-slate-700",
                      val > 0 && `cursor-pointer ${isP ? "hover:bg-sky-800 text-sky-100" : "hover:bg-slate-800 text-slate-100"}`,
                      val === 0 && (isP ? "text-sky-700" : "text-slate-500")
                    )}
                    onClick={() => handleColTotalClick(m, presupuestado, ejecutado)}
                  >
                    {val === 0 ? '-' : formatCurrency(val)}
                  </td>
                );
              })}
              <td 
                className={clsx("p-3 text-right border-l cursor-pointer transition-colors", isP ? "bg-sky-900 border-sky-800 hover:bg-sky-800 text-emerald-300" : "bg-slate-900 border-slate-700 hover:bg-slate-800 text-emerald-400")}
                onClick={handleGrandTotalClick}
              >
                {formatCurrency(mode === 'Presupuestado' ? matrixData.grandTotalPresupuestado : matrixData.grandTotalEjecutado)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

