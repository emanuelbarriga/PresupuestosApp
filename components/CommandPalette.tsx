'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ViewType, FormType } from '@/lib/types';
import { LayoutDashboard, TrendingUp, FolderKanban, Building2, Users, FileText, Database, Settings, Plus, Search, Hash, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

type CommandAction =
  | { type: 'navigate'; view: ViewType; tab?: string; label: string; keywords: string }
  | { type: 'create'; form: FormType; label: string; keywords: string; defaults?: Record<string, string> };

const ALL_ACTIONS: CommandAction[] = [
  // ── Navegación ──
  { type: 'navigate', view: 'Dashboard', label: 'Dashboard', keywords: 'tablero inicio principal' },
  { type: 'navigate', view: 'Extractos', label: 'Extractos Bancarios', keywords: 'extractos banco movimientos' },
  { type: 'navigate', view: 'Datos', label: 'Base de Datos', keywords: 'datos presupuestos ejecuciones proyectos terceros bancos settings' },
  { type: 'navigate', view: 'Datos', tab: 'presupuestos', label: 'Presupuestos', keywords: 'presupuestos datos' },
  { type: 'navigate', view: 'Datos', tab: 'ejecuciones', label: 'Ejecuciones', keywords: 'ejecuciones datos' },
  { type: 'navigate', view: 'Datos', tab: 'bancos', label: 'Cuentas Bancarias', keywords: 'bancos cuentas datos' },
  { type: 'navigate', view: 'Datos', tab: 'terceros', label: 'Terceros', keywords: 'terceros clientes proveedores datos' },
  { type: 'navigate', view: 'Datos', tab: 'proyectos', label: 'Proyectos (Datos)', keywords: 'proyectos datos' },
  { type: 'navigate', view: 'EstadoResultados', label: 'Estado de Resultados', keywords: 'estado resultados ganancias perdidas' },
  { type: 'navigate', view: 'Configuración', label: 'Configuración', keywords: 'configuracion settings empresa' },

  // ── Crear nuevo ──
  { type: 'create', form: 'budget', label: 'Nuevo Presupuesto', keywords: 'crear presupuesto budget nuevo' },
  { type: 'create', form: 'ejecucion', label: 'Nueva Ejecución', keywords: 'crear ejecucion nuevo gasto ingreso' },
  { type: 'create', form: 'project', label: 'Nuevo Proyecto', keywords: 'crear proyecto nuevo' },
  { type: 'create', form: 'tercero', label: 'Nuevo Tercero', keywords: 'crear tercero cliente proveedor nuevo' },
  { type: 'create', form: 'cuenta', label: 'Nueva Cuenta Bancaria', keywords: 'crear cuenta banco nueva' },
  { type: 'create', form: 'extracto', label: 'Subir Extracto', keywords: 'subir extracto banco nuevo' },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard size={16} />,
  Extractos: <FileText size={16} />,
  Datos: <Database size={16} />,
  EstadoResultados: <TrendingUp size={16} />,
  Configuración: <Settings size={16} />,
  budget: <Hash size={16} />,
  ejecucion: <ArrowRight size={16} />,
  project: <FolderKanban size={16} />,
  tercero: <Users size={16} />,
  cuenta: <Building2 size={16} />,
  extracto: <FileText size={16} />,
};

interface CommandPaletteProps {
  onNavigate: (view: ViewType, tab?: string) => void;
  onAddNew: (type: FormType, defaults?: Record<string, string>) => void;
}

export function CommandPalette({ onNavigate, onAddNew }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Keyboard: Tab to open ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Tab when no input/textarea is focused
      if (e.key === 'Tab' && !open) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          setOpen(true);
          setQuery('');
          setSelectedIdx(0);
        }
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Filtered items ──
  const items = useMemo(() => {
    if (!query.trim()) return ALL_ACTIONS;
    const q = query.toLowerCase();
    return ALL_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.keywords.toLowerCase().includes(q)
    );
  }, [query]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIdx >= items.length) setSelectedIdx(Math.max(0, items.length - 1));
  }, [items.length, selectedIdx]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIdx]);

  const execute = useCallback((action: CommandAction) => {
    setOpen(false);
    setQuery('');
    if (action.type === 'navigate') {
      onNavigate(action.view, action.tab);
    } else {
      onAddNew(action.form, action.defaults);
    }
  }, [onNavigate, onAddNew]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIdx]) execute(items[selectedIdx]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab while open cycles through items + closes on last
      if (selectedIdx >= items.length - 1) {
        setOpen(false);
        setQuery('');
      } else {
        setSelectedIdx(i => i + 1);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscá páginas y acciones..."
            className="flex-1 text-sm outline-none placeholder:text-slate-400 bg-transparent"
          />
          <kbd className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {items.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">Sin resultados para "{query}"</p>
          ) : (
            items.map((action, idx) => {
              const icon = action.type === 'navigate'
                ? ACTION_ICONS[action.view]
                : ACTION_ICONS[action.form];
              const isNav = action.type === 'navigate';
              return (
                <button
                  key={`${action.type}-${isNav ? action.view + (action.tab ?? '') : action.form}`}
                  onClick={() => execute(action)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                    idx === selectedIdx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span className={clsx(
                    "shrink-0",
                    idx === selectedIdx ? 'text-indigo-500' : 'text-slate-400',
                  )}>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.type === 'navigate' && action.tab && (
                      <span className="ml-2 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{(action as any).tab}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {isNav ? 'Ir' : 'Crear'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span>↑↓ Navegar</span>
          <span>↵ Seleccionar</span>
          <span>Tab Siguiente</span>
          <span className="ml-auto">ESC Cerrar</span>
        </div>
      </div>
    </div>
  );
}
