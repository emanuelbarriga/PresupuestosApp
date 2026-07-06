'use client';

import React from 'react';
import type { Banco } from '@/lib/types';
import { X } from 'lucide-react';

interface BankConfirmModalProps {
  open: boolean;
  detectedBank: Banco;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onBankChange: (banco: Banco) => void;
}

const BANCOS_CONOCIDOS: Banco[] = ['Bancolombia', 'Bancoomeva', 'Global66'];

export function BankConfirmModal({
  open,
  detectedBank,
  loading,
  onConfirm,
  onCancel,
  onBankChange,
}: BankConfirmModalProps) {
  if (!open) return null;

  const isManual = detectedBank === 'No detectado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-sm font-bold text-slate-800">
            {isManual ? 'Seleccionar banco' : 'Confirmar banco'}
          </h3>
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
          {isManual ? (
            <>
              <p className="text-xs text-slate-600">
                No se pudo detectar el banco automáticamente. Seleccioná uno manualmente:
              </p>
              <select
                value={detectedBank}
                onChange={(e) => onBankChange(e.target.value as Banco)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
              >
                <option value="No detectado" disabled>
                  Seleccionar banco...
                </option>
                {BANCOS_CONOCIDOS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              Se detectó <span className="font-bold text-slate-800">{detectedBank}</span>. ¿Es correcto?
            </p>
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
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Parseando...
              </>
            ) : (
              'Parsear'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
