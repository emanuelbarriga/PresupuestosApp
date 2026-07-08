'use client';

import React from 'react';
import clsx from 'clsx';

interface TipoSwitchProps {
  value: string;
  onChange: (v: string) => void;
}

export function TipoSwitch({ value, onChange }: TipoSwitchProps) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Tipo</label>
      <div className="flex bg-slate-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onChange('ingreso')}
          className={clsx(
            'flex-1 py-2 text-xs font-bold rounded-md transition-all',
            value === 'ingreso' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Ingreso
        </button>
        <button
          type="button"
          onClick={() => onChange('egreso')}
          className={clsx(
            'flex-1 py-2 text-xs font-bold rounded-md transition-all',
            value === 'egreso' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Egreso
        </button>
      </div>
    </div>
  );
}
