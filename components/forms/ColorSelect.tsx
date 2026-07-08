'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ColorSelectProps {
  value: string;
  onChange: (v: string) => void;
  items: { name: string; color: string }[];
  placeholder?: string;
  allowCustom?: boolean;
}

export function ColorSelect({ value, onChange, items, placeholder, allowCustom }: ColorSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.name === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-left flex items-center gap-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
      >
        {selected ? (
          <span
            className="px-2.5 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: selected.color + '20', color: selected.color, border: `1px solid ${selected.color}40` }}
          >
            {selected.name}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder || 'Seleccionar...'}</span>
        )}
        <ChevronDown size={14} className="ml-auto text-slate-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {placeholder && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 transition-colors"
              >
                {placeholder}
              </button>
            )}
            {items.map(item => (
              <button
                key={item.name}
                type="button"
                onClick={() => { onChange(item.name); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span
                  className="px-2.5 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: item.color + '20', color: item.color, border: `1px solid ${item.color}40` }}
                >
                  {item.name}
                </span>
              </button>
            ))}
            {allowCustom && (
              <button
                type="button"
                onClick={() => { onChange('__custom__'); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium border-t border-slate-100"
              >
                + Personalizado
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
