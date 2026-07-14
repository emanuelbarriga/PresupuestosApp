'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface BudgetLinkInfo {
  budgetName: string;
  monto: number;
}

interface ConfirmDeleteModalProps {
  open: boolean;
  ejecucion: {
    descripcion: string;
    montoEjecutado: number;
    budgetLinks?: BudgetLinkInfo[];
    tieneMovimientoVinculado?: boolean;
    movimientoNombre?: string;
  };
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  open,
  ejecucion,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const hasImpact = (ejecucion.budgetLinks && ejecucion.budgetLinks.length > 0) || ejecucion.tieneMovimientoVinculado;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-sm font-bold text-slate-800">Eliminar ejecución</h3>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          <p className="text-xs text-slate-600">
            ¿Estás seguro de eliminar la ejecución{' '}
            <span className="font-semibold text-slate-800">&ldquo;{ejecucion.descripcion}&rdquo;</span>
            {ejecucion.montoEjecutado > 0 && (
              <> por <span className="font-semibold text-slate-800">{formatCurrency(ejecucion.montoEjecutado)}</span></>
            )}?
          </p>

          {/* Budget links impact */}
          {ejecucion.budgetLinks && ejecucion.budgetLinks.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Presupuestos afectados</p>
              <ul className="space-y-1">
                {ejecucion.budgetLinks.map((link, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-amber-800">
                    <span className="font-medium truncate mr-2">{link.budgetName}</span>
                    <span className="font-bold tabular-nums shrink-0">{formatCurrency(link.monto)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-600">
                Al eliminar esta ejecución, los montos se reintegrarán a los presupuestos indicados.
              </p>
            </div>
          )}

          {/* Movimiento vinculado alert */}
          {ejecucion.tieneMovimientoVinculado && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-orange-800">Movimiento bancario vinculado</p>
                <p className="text-[11px] text-orange-700 mt-0.5">
                  Esta ejecución está vinculada a un movimiento bancario
                  {ejecucion.movimientoNombre ? <> &ldquo;{ejecucion.movimientoNombre}&rdquo;</> : ''}.
                  Al eliminarla, el movimiento volverá a estado &ldquo;No convertido&rdquo;.
                </p>
              </div>
            </div>
          )}

          {/* Checkbox */}
          {hasImpact && (
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={loading}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-slate-600 group-hover:text-slate-700 leading-relaxed">
                Entiendo que esto modificará los presupuestos vinculados y/o el movimiento bancario asociado
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (hasImpact && !confirmed)}
            className="px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
