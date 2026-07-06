'use client';

import React from 'react';
import type { MovimientoBancario } from '@/lib/types';
import { Trash2 } from 'lucide-react';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface MovimientosTableProps {
  movimientos: MovimientoBancario[];
  onDelete: (movimientoId: string) => void;
}

export function MovimientosTable({ movimientos, onDelete }: MovimientosTableProps) {
  if (movimientos.length === 0) {
    return (
      <div className="p-4 text-center text-[10px] text-slate-400 italic">
        Sin movimientos para este extracto
      </div>
    );
  }

  const sorted = [...movimientos].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-100">
          <th className="p-2 pl-4 text-[9px] font-bold text-slate-400 uppercase">Fecha</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase">Descripción</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Débito</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Crédito</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Saldo</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center w-24">Estado</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center w-10">Acción</th>
        </tr>
      </thead>
      <tbody className="text-[11px] divide-y divide-slate-200">
        {sorted.map((mov) => (
          <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
            <td className="p-2 pl-4 text-slate-700 font-medium whitespace-nowrap">{mov.fecha}</td>
            <td className="p-2 text-slate-600 max-w-[200px] truncate" title={mov.descripcion}>
              {mov.descripcion}
            </td>
            <td className="p-2 text-right">
              {mov.debito != null ? (
                <span className="text-red-600 font-medium">{formatCurrency(mov.debito)}</span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td className="p-2 text-right">
              {mov.credito != null ? (
                <span className="text-green-600 font-medium">{formatCurrency(mov.credito)}</span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
            <td className="p-2 text-right font-semibold text-slate-800">{formatCurrency(mov.saldo)}</td>
            <td className="p-2 text-center">
              <div className="flex items-center justify-center gap-1">
                {mov.requiereRevision && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                    ⚠ Revisión
                  </span>
                )}
                {mov.posibleDuplicado && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700 whitespace-nowrap">
                    ⓘ Duplicado
                  </span>
                )}
                {!mov.requiereRevision && !mov.posibleDuplicado && (
                  <span className="text-slate-300 text-[9px]">—</span>
                )}
              </div>
            </td>
            <td className="p-2 text-center">
              {mov.posibleDuplicado ? (
                <button
                  onClick={() => onDelete(mov.id)}
                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar movimiento duplicado"
                >
                  <Trash2 size={12} />
                </button>
              ) : (
                <span className="text-slate-200">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
