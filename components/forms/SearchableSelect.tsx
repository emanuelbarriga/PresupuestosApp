'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

export function SearchableSelect({ label, value, onChange, options, placeholder }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = search ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={open ? search : selected?.label || value || ''}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setSearch(''); }}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-lg p-2.5 pr-8 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white cursor-pointer"
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-xs text-slate-500 text-center">Sin resultados</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors',
                    o.value === value ? 'text-indigo-600 font-medium' : 'text-slate-700',
                  )}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
