'use client';

import { useState } from 'react';
import { Project } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface CustomizePanelProps {
  projects: Project[];
  selectedProjects: Set<string>;
  projectSearch: string;
  onProjectsChange?: (selected: Set<string>) => void;
  onSearchChange?: (search: string) => void;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}

export function CustomizePanel({ projects, selectedProjects, projectSearch, onProjectsChange, onSearchChange, canGoBack, onBack, onClose }: CustomizePanelProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = [...projects]
    .filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || (p.descripcion || '').toLowerCase().includes(projectSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleProject = (key: string) => {
    const next = new Set(selectedProjects);
    if (next.has(key)) next.delete(key); else next.add(key);
    onProjectsChange?.(next);
    setShowDropdown(false);
    setActiveIndex(-1);
    onSearchChange?.('');
  };

  const removeProject = (key: string) => {
    const next = new Set(selectedProjects);
    next.delete(key);
    onProjectsChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        const p = filtered[activeIndex];
        toggleProject(p.id || p.name);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const selectedList = projects
    .filter(p => selectedProjects.has(p.id || p.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title="Configuración de Dashboard" canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto select-text">
        <div className="px-5 pt-4 pb-3">
          <div className="relative">
            <input type="text" placeholder="Buscar proyecto..." value={projectSearch}
              onChange={e => { onSearchChange?.(e.target.value); setShowDropdown(true); setActiveIndex(-1); }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
            {showDropdown && projectSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Sin resultados</p>
                ) : (
                  filtered.map((p, idx) => {
                    const key = p.id || p.name;
                    return (
                      <button key={key}
                        onClick={() => toggleProject(key)}
                        className={clsx("w-full text-left px-3 py-2 text-xs transition-colors", idx === activeIndex ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50")}>
                        <span className="truncate">{p.name}</span>
                        {p.descripcion && <span className="text-[10px] text-slate-400 ml-1">— {p.descripcion}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {selectedList.length > 0 && (
          <div className="px-5 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              {selectedList.length} de {projects.length} proyectos
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedList.map(p => {
                const key = p.id || p.name;
                return (
                  <span key={key}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {p.name}
                    <button onClick={() => removeProject(key)} className="hover:text-indigo-900 ml-0.5">
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {selectedProjects.size === 0 && (
          <div className="px-5 py-3">
            <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">
              Mostrando todos los proyectos. Buscá y seleccioná para filtrar.
            </p>
          </div>
        )}

        <div className="px-5 pb-4 border-t border-slate-100 mt-3 pt-3">
          <button onClick={() => { onProjectsChange?.(new Set()); onSearchChange?.(''); }}
            className="w-full text-[10px] font-bold text-indigo-600 hover:text-indigo-700 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
            Mostrar todos los proyectos
          </button>
        </div>
      </div>
    </div>
  );
}
