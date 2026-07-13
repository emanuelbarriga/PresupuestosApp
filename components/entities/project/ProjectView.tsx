'use client'

import { useState, useEffect, useRef } from 'react';
import type { Project, Budget, Ejecucion, SettingsCategorias, NavScreen, EntityType } from '@/lib/types';
import { subscribeCompanySettings, subscribeBudgets, subscribeEjecuciones } from '@/lib/firestore';
import { DF } from '@/components/shared/DF';
import { Save, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { groupByEntity } from '@/components/utils/groupByEntity';
import { EntityTypeBadge } from '@/components/shared/EntityTypeBadge';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface ProjectViewProps {
  project: Project;
  projects: Project[];
  companyId: string;
  settingsData: SettingsCategorias | null;
  year?: number;
  filterTipo?: 'ingreso' | 'egreso';
  filterMode?: 'Presupuestado' | 'Ejecutado';
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => Promise<void>;
  onNavigate: (screen: NavScreen) => void;
}

export function ProjectView({ project, projects, companyId, settingsData, year, filterTipo, filterMode, onSubmit, onNavigate }: ProjectViewProps) {
  const [selectedState, setSelectedState] = useState(project.estado);
  const [saving, setSaving] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const projectRef = useRef(project.id);

  // Subscribe to company settings (for state list)
  const [localSettings, setLocalSettings] = useState<SettingsCategorias | null>(settingsData);
  useEffect(() => {
    if (settingsData) {
      setLocalSettings(settingsData);
      return;
    }
    const unsub = subscribeCompanySettings(companyId, setLocalSettings);
    return () => unsub();
  }, [companyId, settingsData]);

  // Subscribe to budgets filtered by this project (year + optional tipo)
  useEffect(() => {
    const yearStr = year ? String(year) : '';
    const unsub = subscribeBudgets(companyId, (all) => {
      setBudgets(all.filter(b =>
        b.projectId === project.id &&
        (!yearStr || (b.fechaPresupuestado || '').startsWith(yearStr)) &&
        (!filterTipo || b.tipo === filterTipo)
      ));
    });
    return () => unsub();
  }, [companyId, project.id, year, filterTipo]);

  // Subscribe to ejecuciones filtered by this project (year + optional tipo)
  useEffect(() => {
    const yearStr = year ? String(year) : '';
    const unsub = subscribeEjecuciones(companyId, (all) => {
      setEjecuciones(all.filter(e =>
        e.projectId === project.id &&
        (!yearStr || (e.fechaEjecutado || '').startsWith(yearStr)) &&
        (!filterTipo || e.tipo === filterTipo)
      ));
    });
    return () => unsub();
  }, [companyId, project.id, year, filterTipo]);

  // Sync selected state when project record changes
  useEffect(() => {
    if (projectRef.current !== project.id) {
      projectRef.current = project.id;
      setSelectedState(project.estado);
    }
  }, [project.id, project.estado]);

  const isInferred = !project.id || !(projects || []).some(p => p.id === project.id);
  const hasChanges = selectedState !== project.estado;

  const handleSaveState = async () => {
    if (isInferred || !project.id || !hasChanges) return;
    setSaving(true);
    await onSubmit({
      mode: 'edit',
      entity: 'project',
      record: project,
      data: { estado: selectedState },
    });
    setSaving(false);
  };

  const handleCreateProject = async () => {
    if (!project.name) return;
    await onSubmit({
      mode: 'create',
      entity: 'project',
      data: { name: project.name, clientName: project.clientName || 'Sin cliente', clientId: '', estado: selectedState },
    });
  };

  const projectStates = (localSettings?.stateProject || [])
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((s: any) => s.name);

  return (
    <>
      {/* Banner proyecto fantasma */}
      {isInferred && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-800">Proyecto no encontrado</p>
              <p className="text-xs text-orange-600">Este proyecto no existe en la base de datos. Podría haber sido eliminado o estar mal referenciado. Los datos mostrados son históricos.</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Proyecto</p>
        {!isInferred && project.id && (
          <button onClick={() => onNavigate({ type: 'entity', entity: 'project', mode: 'edit', record: project })}
            className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
            <Save size={12} /> Editar
          </button>
        )}
      </div>
      <DF label="Sigla" v={project.name} />
      {project.descripcion && <DF label="Nombre completo" v={project.descripcion} />}
      <DF label="Cliente" v={project.clientName || '—'} />
      {project.tipoProyectos && <DF label="Tipo de proyecto" v={project.tipoProyectos} />}
      {project.cantidad ? <DF label="Cantidad" v={String(project.cantidad) + (project.unidades ? ` ${project.unidades}` : '')} /> : null}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado</p>
        {isInferred ? (
          <div className="space-y-2">
            <select disabled value={selectedState} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed">
              {projectStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-[10px] text-amber-600 font-medium">Proyecto inferido — aún no tiene documento.</p>
            <button onClick={handleCreateProject} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg py-2 text-xs font-bold transition-colors">
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
              {projectStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {hasChanges && (
              <button onClick={handleSaveState} disabled={saving} aria-label="Guardar estado"
                className="px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm">
                <Save size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {project.soloEgresos && (
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200">Solo egresos</span>
        </div>
      )}
      {(!filterMode || filterMode === 'Presupuestado') && (
        <>
          {filterTipo && (
            <div className="mt-3">
              <p className={clsx("text-[10px] font-bold uppercase", filterTipo === 'ingreso' ? "text-emerald-600" : "text-rose-600")}>
                {filterTipo === 'ingreso' ? 'Ingresos' : 'Egresos'} Presupuestados
              </p>
              <p className={clsx("text-sm font-bold mt-0.5", filterTipo === 'ingreso' ? "text-emerald-700" : "text-rose-700")}>
                {formatCurrency(budgets.reduce((s, b) => s + b.montoPresupuestado, 0))}
              </p>
            </div>
          )}
          <AccordionSection
            title="Presupuestos"
            count={budgets.length}
            emptyLabel="Sin presupuestos"
            groups={groupByEntity(budgets).map(g => ({ ...g, total: g.items.reduce((sum, b) => sum + b.montoPresupuestado, 0) }))}
            entityType="budget"
            onNavigate={onNavigate}
            expandedGroups={expandedGroups}
            onToggle={(name) => setExpandedGroups(prev => {
              const next = new Set(prev);
              if (next.has(name)) next.delete(name); else next.add(name);
              return next;
            })}
          />
        </>
      )}
      {(!filterMode || filterMode === 'Ejecutado') && (
        <>
          {filterTipo && (
            <div className="mt-3">
              <p className={clsx("text-[10px] font-bold uppercase", filterTipo === 'ingreso' ? "text-emerald-600" : "text-rose-600")}>
                {filterTipo === 'ingreso' ? 'Ingresos' : 'Egresos'} Ejecutados
              </p>
              <p className={clsx("text-sm font-bold mt-0.5", filterTipo === 'ingreso' ? "text-emerald-700" : "text-rose-700")}>
                {formatCurrency(ejecuciones.reduce((s, e) => s + e.montoEjecutado, 0))}
              </p>
            </div>
          )}
          <AccordionSection
            title="Ejecuciones"
            count={ejecuciones.length}
            emptyLabel="Sin ejecuciones"
            groups={groupByEntity(ejecuciones).map(g => ({ ...g, total: g.items.reduce((sum, e) => sum + e.montoEjecutado, 0) }))}
            entityType="ejecucion"
            onNavigate={onNavigate}
            expandedGroups={expandedGroups}
            onToggle={(name) => setExpandedGroups(prev => {
              const next = new Set(prev);
              if (next.has(name)) next.delete(name); else next.add(name);
              return next;
            })}
          />
        </>
      )}
    </>
  );
}

/** Accordion section for grouped budgets/ejecuciones — collapsed by default */
function AccordionSection({
  title, count, emptyLabel, groups, entityType, onNavigate, expandedGroups, onToggle,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  groups: Array<{ entityName: string; entityType: string; items: any[]; total: number }>;
  entityType: 'budget' | 'ejecucion';
  onNavigate: (screen: NavScreen) => void;
  expandedGroups: Set<string>;
  onToggle: (name: string) => void;
}) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="border-t border-slate-100 pt-3 mt-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{title} ({count})</p>
      {count === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">{emptyLabel}</p>
      ) : (
        [...groups].sort((a, b) => a.entityName.localeCompare(b.entityName)).map(group => {
          const isOpen = expandedGroups.has(group.entityName);
          return (
            <div key={group.entityName} className="mb-2 last:mb-0 border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => onToggle(group.entityName)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isOpen ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                  <span className="text-xs font-semibold text-slate-700 truncate">{group.entityName}</span>
                  <EntityTypeBadge type={group.entityType as any} />
                </div>
                <span className="text-xs font-bold text-slate-700 shrink-0 ml-2">{formatCurrency(group.total)}</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-slate-100 bg-white">
                  {group.items.map((item: any) => (
                    <div key={item.id}
                      onClick={() => onNavigate({ type: 'entity', entity: entityType, mode: 'view', record: item })}
                      className="flex justify-between text-xs px-3 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-600 truncate mr-2">
                        {entityType === 'ejecucion' ? `${item.fechaEjecutado || ''} ${item.descripcion ? `· ${item.descripcion}` : ''}` : item.descripcion}
                      </span>
                      <span className="font-semibold text-slate-700 shrink-0">
                        {formatCurrency(entityType === 'ejecucion' ? item.montoEjecutado : item.montoPresupuestado)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
