'use client'

import { useState, useMemo } from 'react';
import { Budget, Ejecucion } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface PnLRow {
  id: string;
  label: string;
  value: number;
  editable: boolean;
  indent: number;
  bold: boolean;
}

interface PnLRecord {
  projectName: string;
  tipo: 'ingreso' | 'egreso';
  montoPresupuestado: number;
  montoEjecutado: number;
}

const currentYear = new Date().getFullYear();

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

/**
 * Pure function: computes the 12-row P&L statement from filtered records.
 * Admin project: name.trim().toLowerCase() === 'admin'
 */
export function computePnL(
  records: PnLRecord[],
  mode: 'Presupuestado' | 'Ejecutado',
  devoluciones: number,
  gastosFinancieros: number,
): PnLRow[] {
  const isPresupuestado = mode === 'Presupuestado';
  const getMonto = (r: PnLRecord): number =>
    isPresupuestado ? r.montoPresupuestado : r.montoEjecutado;

  const isAdmin = (name: string): boolean =>
    name.trim().toLowerCase() === 'admin';

  // F1: Sum of ingresos (all projects)
  const F1 = records
    .filter(r => r.tipo === 'ingreso')
    .reduce((sum, r) => sum + getMonto(r), 0);

  const F2 = devoluciones;
  const F3 = F1 - F2;

  // F4: Sum of egresos (non-Admin projects)
  const F4 = records
    .filter(r => r.tipo === 'egreso' && !isAdmin(r.projectName))
    .reduce((sum, r) => sum + getMonto(r), 0);

  const F5 = F3 - F4;

  // F6: Sum of egresos (Admin project, case-insensitive)
  const F6 = records
    .filter(r => r.tipo === 'egreso' && isAdmin(r.projectName))
    .reduce((sum, r) => sum + getMonto(r), 0);

  const F7 = gastosFinancieros;
  const F8 = (F4 + F6 + F7) * 0.004;
  const F9 = F5 - F6 - F7 - F8;
  const F10 = F1 * 0.081;
  const F11 = Math.min(F8, F10);
  const F12 = F9 - F10 + F11;

  return [
    { id: 'F1',  label: 'Ingresos Brutos',             value: F1,  editable: false, indent: 0, bold: false },
    { id: 'F2',  label: 'Devoluciones, rebajas y desc.', value: F2,  editable: true,  indent: 1, bold: false },
    { id: 'F3',  label: 'Ingresos Netos',               value: F3,  editable: false, indent: 1, bold: true  },
    { id: 'F4',  label: 'Costos de Operación',          value: F4,  editable: false, indent: 0, bold: false },
    { id: 'F5',  label: 'Utilidad Bruta',               value: F5,  editable: false, indent: 1, bold: true  },
    { id: 'F6',  label: 'Gastos Administrativos',       value: F6,  editable: false, indent: 0, bold: false },
    { id: 'F7',  label: 'Gastos Financieros',           value: F7,  editable: true,  indent: 1, bold: false },
    { id: 'F8',  label: 'GMF (4×1000)',                 value: F8,  editable: false, indent: 1, bold: false },
    { id: 'F9',  label: 'Utilidad Operacional',         value: F9,  editable: false, indent: 1, bold: true  },
    { id: 'F10', label: 'Impuesto SIMPLE (8.1%)',       value: F10, editable: false, indent: 0, bold: false },
    { id: 'F11', label: 'Descuento Tributario GMF',     value: F11, editable: false, indent: 1, bold: false },
    { id: 'F12', label: 'Utilidad Neta',                value: F12, editable: false, indent: 0, bold: true  },
  ];
}

interface EstadoResultadosProps {
  budgets: Budget[];
  ejecuciones: Ejecucion[];
}

export function EstadoResultados({ budgets, ejecuciones }: EstadoResultadosProps) {
  const [mode, setMode] = useState<'Presupuestado' | 'Ejecutado'>('Presupuestado');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [devoluciones, setDevoluciones] = useState<number>(0);
  const [gastosFinancieros, setGastosFinancieros] = useState<number>(0);

  const yearStr = String(selectedYear);

  const filteredRecords = useMemo(() => {
    const records = mode === 'Presupuestado' ? budgets : ejecuciones;
    return records.filter(r => {
      const fecha =
        mode === 'Presupuestado'
          ? (r as Budget).fechaPresupuestado
          : (r as Ejecucion).fechaEjecutado;
      return (fecha || '').startsWith(yearStr) && (r as { archivado?: boolean }).archivado !== true;
    });
  }, [budgets, ejecuciones, mode, yearStr]);

  const recordsForPnL: PnLRecord[] = useMemo(
    () =>
      filteredRecords.map(r => ({
        projectName: r.projectName,
        tipo: r.tipo,
        montoPresupuestado: (r as Budget).montoPresupuestado ?? 0,
        montoEjecutado: (r as Ejecucion).montoEjecutado ?? 0,
      })),
    [filteredRecords],
  );

  const rows = useMemo(
    () => computePnL(recordsForPnL, mode, devoluciones, gastosFinancieros),
    [recordsForPnL, mode, devoluciones, gastosFinancieros],
  );

  const handleF2Change = (val: string) => {
    const n = Number(val);
    if (!isNaN(n)) setDevoluciones(n);
  };

  const handleF7Change = (val: string) => {
    const n = Number(val);
    if (!isNaN(n)) setGastosFinancieros(n);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-white">
      {/* Header */}
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-white border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Estado de Resultados</h1>
          <p className="text-[10px] uppercase tracking-wider font-medium text-slate-500">Profit &amp; Loss</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Year selector */}
          <div className="flex items-center gap-1 border p-1 rounded-lg bg-slate-100 border-slate-200">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 text-xs font-bold text-slate-700 min-w-[48px] text-center select-none">
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {/* Mode toggle */}
          <div className="p-1 rounded-lg flex border bg-slate-100 border-slate-200">
            <button
              className={clsx(
                'px-4 py-1 text-xs font-bold rounded-md transition-colors',
                mode === 'Presupuestado' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
              onClick={() => setMode('Presupuestado')}
            >
              Presupuestado
            </button>
            <button
              className={clsx(
                'px-4 py-1 text-xs font-bold rounded-md transition-colors',
                mode === 'Ejecutado' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
              onClick={() => setMode('Ejecutado')}
            >
              Ejecutado
            </button>
          </div>
        </div>
      </header>

      {/* P&L Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                  Código
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Concepto
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className={clsx(
                    'border-b border-slate-100 hover:bg-slate-50/50 transition-colors',
                    row.bold && 'bg-slate-50',
                  )}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={clsx(
                        'text-xs font-mono font-semibold px-1.5 py-0.5 rounded',
                        row.bold
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {row.id}
                    </span>
                  </td>
                  <td
                    className={clsx(
                      'py-2.5 px-3 text-sm',
                      row.bold ? 'font-semibold text-slate-800' : 'text-slate-600',
                    )}
                    style={{ paddingLeft: `${12 + row.indent * 20}px` }}
                  >
                    {row.label}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.editable ? (
                      <input
                        type="number"
                        value={row.id === 'F2' ? (devoluciones || '') : (gastosFinancieros || '')}
                        onChange={e =>
                          row.id === 'F2' ? handleF2Change(e.target.value) : handleF7Change(e.target.value)
                        }
                        className={clsx(
                          'w-full text-right text-sm font-mono px-2 py-1 rounded border',
                          'bg-yellow-50 border-yellow-200',
                          'focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400',
                          'text-slate-700',
                        )}
                        placeholder="0"
                      />
                    ) : (
                      <span
                        className={clsx(
                          'text-sm font-mono',
                          row.bold ? 'font-bold text-slate-800' : 'text-slate-600',
                        )}
                      >
                        {formatCurrency(row.value)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
