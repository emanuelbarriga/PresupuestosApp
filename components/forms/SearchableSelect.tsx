'use client';

import React, { useState } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  /** When provided, shows "Crear {createLabel}: {search}" when search has no match */
  onCreate?: (searchText: string) => void;
  createLabel?: string;
}

export function SearchableSelect({ label, value, onChange, options, placeholder, onCreate, createLabel }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = search ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  const selected = options.find(o => o.value === value);
  const showCreate = onCreate && search && filtered.length === 0;

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
        {value ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
            title="Limpiar selección"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(o => (
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
            ))}
            {showCreate && (
              <button
                type="button"
                onClick={() => { onCreate(search); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors border-t border-slate-100 flex items-center gap-1.5"
              >
                <Plus size={13} /> Crear {createLabel}: {search}
              </button>
            )}
            {!showCreate && filtered.length === 0 && (
              <p className="p-3 text-xs text-slate-500 text-center">Sin resultados</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Multi-Select Variant ─────────────────────────────────────────────────

interface MultiSearchableSelectProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

export function MultiSearchableSelect({ label, values, onChange, options, placeholder }: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedSet = new Set(values);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  const showCreate = false; // No create in multi-select for MVP

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(values.filter(v => v !== value));
    } else {
      onChange([...values, value]);
    }
    setSearch('');
  };

  const removeValue = (value: string) => {
    onChange(values.filter(v => v !== value));
  };

  return (
    <div className="relative">
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>

      {/* Chips + Input area */}
      <div
        className={clsx(
          'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 outline-none transition-all bg-white cursor-text min-h-[42px]',
          'flex flex-wrap items-center gap-1.5',
        )}
        onClick={() => { setOpen(true); }}
      >
        {values.map(v => {
          const opt = options.find(o => o.value === v);
          if (!opt) return null;
          return (
            <span
              key={v}
              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full border border-indigo-200"
            >
              {opt.label}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeValue(v); }}
                className="text-indigo-400 hover:text-rose-500 transition-colors"
                title={`Quitar ${opt.label}`}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={open ? search : ''}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); }}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] border-none outline-none text-sm bg-transparent p-0.5"
        />
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </div>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(''); }} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(o => {
              const isSelected = selectedSet.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { toggleValue(o.value); }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2',
                    isSelected ? 'text-indigo-600 font-medium' : 'text-slate-700',
                  )}
                >
                  <span>{o.label}</span>
                  {isSelected && (
                    <span className="text-indigo-500 text-xs font-bold">✓</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="p-3 text-xs text-slate-500 text-center">Sin resultados</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
