'use client';

import { useState, useEffect } from 'react';
import { ErConfig, ErTaxRegime, ErLineConfig, Project } from '@/lib/types';
import { ER_LINES, type ErLineMeta } from '@/components/EstadoResultados';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { DEFAULT_ER_CONFIG } from '@/lib/er-config-defaults';
import { X, Search, Check, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface ErConfigPanelProps {
  config: ErConfig;
  projects: Project[];
  onSave: (config: ErConfig) => void;
  onConfigChange?: (config: ErConfig) => void;
  onClose: () => void;
  onBack: () => void;
  canGoBack: boolean;
  saving?: boolean;
}

/** Filtra proyectos según el tipo de línea y el término de búsqueda */
function useFilteredProjects(projects: Project[], tipo: 'ingreso' | 'egreso', search: string) {
  return projects.filter(p => {
    if (tipo === 'ingreso' && p.soloEgresos) return false;
    if (tipo === 'egreso' && p.soloIngresos) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.descripcion || '').toLowerCase().includes(term) ||
      (p.clientName || '').toLowerCase().includes(term)
    );
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function ErConfigPanel({ config, projects, onSave, onConfigChange, onClose, onBack, canGoBack, saving }: ErConfigPanelProps) {
  const safeConfig = config || DEFAULT_ER_CONFIG;
  const [taxRegime, setTaxRegime] = useState<ErTaxRegime>(safeConfig.taxRegime);
  const [lineItems, setLineItems] = useState(safeConfig.lineItems);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [showDropdown, setShowDropdown] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Notificar cambios al padre para live preview
  useEffect(() => {
    const current: ErConfig = { ...safeConfig, taxRegime, lineItems };
    onConfigChange?.(current);
    setHasChanges(
      taxRegime !== safeConfig.taxRegime ||
      JSON.stringify(lineItems) !== JSON.stringify(safeConfig.lineItems),
    );
  }, [taxRegime, lineItems]);

  const handleSave = () => {
    onSave({ ...safeConfig, taxRegime, lineItems });
  };

  const handleDiscard = () => {
    // Revertir al estado inicial
    setTaxRegime(safeConfig.taxRegime);
    setLineItems(safeConfig.lineItems);
    onClose();
  };

  const addProject = (key: string, projectId: string) => {
    setLineItems(prev => {
      const line = { ...prev[key as keyof typeof prev] };
      if (!line.projectIds.includes(projectId)) {
        line.projectIds = [...line.projectIds, projectId];
      }
      return { ...prev, [key]: line };
    });
    // No cerrar el dropdown ni limpiar el search para seguir seleccionando
    setSearchTerms(prev => ({ ...prev, [key]: '' }));
  };

  const removeProject = (key: string, projectId: string) => {
    setLineItems(prev => {
      const line = { ...prev[key as keyof typeof prev] };
      line.projectIds = line.projectIds.filter(id => id !== projectId);
      return { ...prev, [key]: line };
    });
  };

  const projectName = (id: string): string => {
    return projects.find(p => p.id === id || p.name === id)?.name || id;
  };

  return (
    <div className="flex flex-col h-full w-full">
      <PanelHeader title="Configuración ER" onClose={handleDiscard} onBack={onBack} canGoBack={canGoBack} />

      {hasChanges && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-[10px] font-medium text-amber-800">Hay cambios sin guardar</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Tax Regime Selector */}
        <div>
          <label className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 block">Régimen Tributario</label>
          <select
            value={taxRegime}
            onChange={e => setTaxRegime(e.target.value as ErTaxRegime)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
          >
            <option value="simple">Régimen Simple de Tributación (8.1% de Ingresos)</option>
            <option value="comun">Régimen Común (35% de la Utilidad)</option>
          </select>
          {taxRegime === 'comun' && (
            <p className="text-[10px] text-amber-600 mt-1">
              En régimen común no se aplica GMF (4×1000) ni descuento tributario.
            </p>
          )}
        </div>

        <hr className="border-slate-100" />

        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
          Asignación de Proyectos por Línea
        </p>

        {ER_LINES.map(line => {
          const cfg = lineItems[line.key] || { projectIds: [] };
          const searchTerm = searchTerms[line.key] || '';
          const isOpen = showDropdown[line.key] || false;

          // Proyectos ya asignados a otras líneas del mismo tipo (ingreso/egreso)
          const usedInOtherLines = new Set<string>();
          for (const [otherKey, otherLine] of Object.entries(lineItems)) {
            if (otherKey === line.key) continue;
            const otherMeta = ER_LINES.find(l => l.key === otherKey);
            if (otherMeta?.tipo === line.tipo) {
              otherLine.projectIds.forEach(id => usedInOtherLines.add(id));
            }
          }

          const filteredProjects = useFilteredProjects(projects, line.tipo, searchTerm)
            .filter(p => !usedInOtherLines.has(p.id || p.name));

          return (
            <div key={line.key} className="border rounded-xl p-3 border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">{line.label}</label>
                <span className={clsx(
                  'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                  line.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                )}>
                  {line.tipo === 'ingreso' ? 'Ingresos' : 'Egresos'}
                </span>
              </div>

              {/* Selected project badges */}
              {cfg.projectIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cfg.projectIds.map(pid => (
                    <span key={pid}
                      className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold max-w-full',
                        line.tipo === 'ingreso'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      )}
                    >
                      <span className="truncate max-w-[120px]">{projectName(pid)}</span>
                      <button
                        onClick={() => removeProject(line.key, pid)}
                        className="hover:opacity-60 transition-opacity shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Project search + dropdown */}
              <div className="relative">
                <div className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white">
                  <Search size={12} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar proyecto..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerms(prev => ({ ...prev, [line.key]: e.target.value }));
                      setShowDropdown(prev => ({ ...prev, [line.key]: true }));
                    }}
                    onFocus={() => setShowDropdown(prev => ({ ...prev, [line.key]: true }))}
                    className="flex-1 outline-none bg-transparent text-slate-700 placeholder:text-slate-400 min-w-0"
                  />
                </div>

                {isOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProjects.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400 italic">Sin resultados</p>
                    ) : (
                      filteredProjects.map(p => {
                        const isSelected = cfg.projectIds.includes(p.id || p.name);
                        return (
                          <button
                            key={p.id || p.name}
                            onClick={() => {
                              if (isSelected) {
                                removeProject(line.key, p.id || p.name);
                              } else {
                                addProject(line.key, p.id || p.name);
                              }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors"
                          >
                            <span className={clsx(
                              'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                              isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                            )}>
                              {isSelected && <Check size={10} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-slate-700 truncate block">{p.name}</span>
                              {p.descripcion && (
                                <span className="text-[10px] text-slate-400 truncate block">{p.descripcion}</span>
                              )}
                            </div>
                            {p.estado && (
                              <span className={clsx(
                                'px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase shrink-0',
                                p.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700' :
                                p.estado === 'Negociación' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-500'
                              )}>{p.estado}</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {isOpen && (
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(prev => ({ ...prev, [line.key]: false }))} />
                )}
              </div>

              {cfg.projectIds.length === 0 && (
                <p className="text-[10px] text-slate-400 italic">
                  Sin proyectos asignados. Se usará el valor por defecto.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="p-4 border-t border-slate-200 space-y-2">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full py-2.5 px-4 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
        {hasChanges && (
          <button
            onClick={handleDiscard}
            className="w-full py-2 px-4 text-xs font-bold text-slate-500 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={12} />
            Descartar cambios
          </button>
        )}
      </div>
    </div>
  );
}
