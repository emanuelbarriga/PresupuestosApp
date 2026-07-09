'use client'

import { useState, useEffect, useRef } from 'react';
import { Project, Budget, Ejecucion, SettingsCategorias, ActiveForm, NavScreen } from '@/lib/types';
import { subscribeCompanySettings } from '@/lib/firestore';
import { DF } from '@/components/shared/DF';
import { Save } from 'lucide-react';
import clsx from 'clsx';
import { groupByEntity } from '@/components/utils/groupByEntity';
import { EntityTypeBadge } from '@/components/shared/EntityTypeBadge';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export function ProjectView({ project, budgets, ejecuciones, companyId, projects, onFormSubmit, onNavigate }: {
  project: Project; budgets: Budget[]; ejecuciones: Ejecucion[]; companyId: string; projects?: Project[]; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; onNavigate: (screen: NavScreen) => void;
}) {
  const [selectedState, setSelectedState] = useState(project.estado);
  const [saving, setSaving] = useState(false);
  const [settingsCat, setSettingsCat] = useState<SettingsCategorias | null>(null);
  const projectRef = useRef(project.id);

  useEffect(() => {
    const unsub = subscribeCompanySettings(companyId, setSettingsCat);
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (projectRef.current !== project.id) {
      projectRef.current = project.id;
      setSelectedState(project.estado);
    }
  }, [project.id, project.estado]);

  const isInferred = !(projects || []).some(p => p.name === project.name);

  const hasChanges = selectedState !== project.estado;

  const handleSaveState = async () => {
    if (isInferred || !project.id || !hasChanges) return;
    setSaving(true);
    await onFormSubmit(
      { mode: 'edit', type: 'project', record: project },
      { estado: selectedState },
    );
    setSaving(false);
  };

  const handleCreateProject = async () => {
    if (!project.name) return;
    await onFormSubmit(
      { mode: 'add', type: 'project' },
      { name: project.name, clientName: project.clientName || 'Sin cliente', clientId: '', estado: selectedState },
    );
  };

  const projectStates = (settingsCat?.stateProject || [])
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((s: any) => s.name);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Proyecto</p>
        {!isInferred && project.id && (
          <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'project', record: project } })}
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
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Presupuestos ({budgets.length})</p>
        {budgets.length === 0 ? <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin presupuestos</p> : (() => {
          const groupedBudgets = groupByEntity(budgets).map(g => ({
            ...g,
            total: g.items.reduce((sum, b) => sum + b.montoPresupuestado, 0),
          }));
          const sortedGroups = [...groupedBudgets].sort((a, b) => a.entityName.localeCompare(b.entityName));
          return sortedGroups.map(group => (
            <div key={group.entityName} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                    <EntityTypeBadge type={group.entityType} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
                </div>
                <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                  {group.items.map(b => (
                  <div key={b.id} className="flex justify-between text-xs px-2 py-1.5 hover:bg-slate-50">
                    <span className="text-slate-600 truncate mr-2">{b.descripcion}</span>
                    <span className="font-semibold text-slate-700 shrink-0">{formatCurrency(b.montoPresupuestado)}</span>
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ejecuciones ({ejecuciones.length})</p>
        {ejecuciones.length === 0 ? <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin ejecuciones</p> : (() => {
          const groupedEjs = groupByEntity(ejecuciones).map(g => ({
            ...g,
            total: g.items.reduce((sum, e) => sum + e.montoEjecutado, 0),
          }));
          const sortedGroups = [...groupedEjs].sort((a, b) => a.entityName.localeCompare(b.entityName));
          return sortedGroups.map(group => (
            <div key={group.entityName} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                  <EntityTypeBadge type={group.entityType} />
                </div>
                <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
              </div>
              <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                {group.items.map(e => (
                  <div key={e.id} className="flex justify-between text-xs px-2 py-1.5 hover:bg-slate-50">
                    <span className="text-slate-600 truncate mr-2">{e.fechaEjecutado} {e.descripcion ? `· ${e.descripcion}` : ''}</span>
                    <span className="font-semibold text-slate-700 shrink-0">{formatCurrency(e.montoEjecutado)}</span>
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
    </>
  );
}
