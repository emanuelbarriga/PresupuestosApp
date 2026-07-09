'use client';

import { useState } from 'react';
import { SidepanelData, Budget, Ejecucion, Comprobante, Project, NavScreen, MONTHS, type Month } from '@/lib/types';
import { updateBudget, updateEjecucion } from '@/lib/firestore';
import { deleteFile } from '@/lib/fileUpload';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { ComprobantesViewer } from '@/components/upload/ComprobantesViewer';
import { FileText, Plus, Save, Trash2, Paperclip } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface DataPanelProps {
  data: SidepanelData;
  companyId: string;
  onClose: () => void;
  onNavigate: (screen: NavScreen) => void;
  projects?: Project[];
  canGoBack: boolean;
  onBack: () => void;
}

export function DataPanel({ data, companyId, onClose, onNavigate, projects, canGoBack, onBack }: DataPanelProps) {
  const [archiveConfirm, setArchiveConfirm] = useState<{ type: 'budget' | 'ejecucion'; id: string } | null>(null);

  // Direct updateEjecucion calls preserved — will be cleaned up in Phase 5
  const handleArchive = async (type: 'budget' | 'ejecucion', id: string, archived: boolean) => {
    try {
      if (type === 'budget') {
        await updateBudget(companyId, id, { archivado: archived });
      } else {
        await updateEjecucion(companyId, id, { archivado: archived });
      }
    } catch (err) {
    }
    setArchiveConfirm(null);
  };

  // Parse title "Proyecto / Mes" for cell-level data
  const titleParts = data.title?.split(' / ') || [];
  const cellProjectName = titleParts.length === 2 ? titleParts[0] : '';
  const cellMonth = titleParts.length === 2 ? titleParts[1] : '';
  const cellProject = projects?.find(p => p.name === cellProjectName || p.id === cellProjectName);

  const handleAddFromCell = (formType: 'budget' | 'ejecucion') => {
    if (!cellProjectName || !cellMonth) return;
    const monthIndex = MONTHS.indexOf(cellMonth as Month);
    if (monthIndex < 0) return;
    const currentYear = new Date().getFullYear();
    const defaults: Record<string, string> = {
      projectName: cellProjectName,
      tipo: data.tipo,
    };
    if (cellProject) defaults.projectId = cellProject.id;
    if (cellProject?.clientName) {
      defaults.entityName = cellProject.clientName;
      defaults.entityType = 'client';
    }
    if (formType === 'budget') {
      defaults.mesPresupuestado = cellMonth;
      defaults.fechaEjecutado = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    } else {
      defaults.fechaEjecutado = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    }
    onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: formType, defaults } });
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader
        title={`Detalle de ${data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ${data.mode === 'Presupuestado' ? 'Presupuestado' : 'Ejecutado'}`}
        canGoBack={canGoBack}
        onBack={onBack}
        onClose={onClose}
      />
      <div className="px-5 py-3">
        <div className={clsx("rounded-xl p-4 border", data.mode === 'Presupuestado' ? "bg-sky-50 border-sky-100 text-sky-900" : "bg-slate-800 border-slate-700 text-white")}>
          <p className={clsx("text-[10px] font-bold uppercase tracking-widest", data.mode === 'Presupuestado' ? "text-sky-600" : "text-slate-400")}>Seleccionado</p>
          <p className="text-sm font-bold mt-1">{data.title}</p>
          <p className="text-xs mt-1 opacity-80">{data.subtitle}</p>
        </div>
        {cellProjectName && cellMonth && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => handleAddFromCell('budget')}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors">
              <Plus size={13} /> {data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} Presupuestado
            </button>
            <button onClick={() => handleAddFromCell('ejecucion')}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors">
              <Plus size={13} /> {data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} Ejecutado
            </button>
          </div>
        )}
      </div>

      {/* BODY — scrollable, cambia según modo */}
      <div className="flex-1 overflow-y-auto p-6">
        {data.mode === 'Presupuestado' && (
          <div className="mb-6"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Presupuestos ({data.budgets.length})</p>
          {(() => {
            const grouped = data.budgets.reduce((acc, b) => {
              const key = b.entityId || b.entityName || 'Sin entidad';
              if (!acc[key]) acc[key] = { entityName: b.entityName || 'Sin entidad', entityType: b.entityType, items: [], total: 0 };
              acc[key].items.push(b);
              acc[key].total += b.montoPresupuestado;
              return acc;
            }, {} as Record<string, { entityName: string; entityType: string; items: Budget[]; total: number }>);
            const sorted = Object.values(grouped).sort((a, b) => a.entityName.localeCompare(b.entityName));
            return sorted.map(group => (
              <div key={group.entityName} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                    <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", group.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : group.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : group.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                      {group.entityType === 'ambos' ? 'C/P' : group.entityType === 'client' ? 'C' : group.entityType === 'provider' ? 'P' : '?'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
                </div>
                <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                  {group.items.map(b => (
                    <div key={b.id} className="px-2 py-1.5">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-slate-700 truncate">{b.descripcion}</p>
                          <p className="text-[10px] text-slate-400">{b.mesPresupuestado}</p>
                        </div>
                        <p className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(b.montoPresupuestado)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: b, ejecuciones: [] } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                          <FileText size={11} /> Ver
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'budget', record: b } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                          <Save size={11} /> Editar
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: 'ejecucion', defaults: { projectId: b.projectId || '', projectName: b.projectName || '', entityId: b.entityId || '', entityName: b.entityName || '', entityType: b.entityType || 'client', tipo: b.tipo } } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">
                          <Plus size={11} /> Ejecutar
                        </button>
                        {archiveConfirm?.id === b.id && archiveConfirm?.type === 'budget' ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleArchive('budget', b.id, !b.archivado)}
                              className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded transition-colors">
                              Confirmar
                            </button>
                            <button onClick={() => setArchiveConfirm(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setArchiveConfirm({ type: 'budget', id: b.id })}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded transition-colors">
                            {b.archivado ? <Save size={11} /> : <Trash2 size={11} />} {b.archivado ? 'Desarchivar' : 'Archivar'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}</div>
        )}

        {data.mode === 'Ejecutado' && (
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ejecuciones ({data.ejecuciones.length})</p>
          {(() => {
            const grouped = data.ejecuciones.reduce((acc, e) => {
              const key = e.entityId || e.entityName || 'Sin entidad';
              if (!acc[key]) acc[key] = { entityName: e.entityName || 'Sin entidad', entityType: e.entityType, items: [], total: 0 };
              acc[key].items.push(e);
              acc[key].total += e.montoEjecutado;
              return acc;
            }, {} as Record<string, { entityName: string; entityType: string; items: Ejecucion[]; total: number }>);
            const sorted = Object.values(grouped).sort((a, b) => a.entityName.localeCompare(b.entityName));
            return sorted.map(group => (
              <div key={group.entityName} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                    <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", group.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : group.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : group.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                      {group.entityType === 'ambos' ? 'C/P' : group.entityType === 'client' ? 'C' : group.entityType === 'provider' ? 'P' : '?'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
                </div>
                <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                  {group.items.map(e => {
                    const cCount = e.comprobantes?.length || 0;
                    return (
                    <div key={e.id} className="px-2 py-1.5">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-slate-700 truncate">{e.descripcion}</p>
                          <p className="text-[10px] text-slate-400">{e.fechaEjecutado}</p>
                        </div>
                        <p className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(e.montoEjecutado)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: e } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                          <FileText size={11} /> Ver
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'ejecucion', record: e } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                          <Save size={11} /> Editar
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'ejecucion', record: e } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors">
                          <Paperclip size={11} /> {cCount > 0 ? `Comprobantes (${cCount})` : 'Agregar comprobante'}
                        </button>
                        {archiveConfirm?.id === e.id && archiveConfirm?.type === 'ejecucion' ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleArchive('ejecucion', e.id, !e.archivado)}
                              className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded transition-colors">
                              Confirmar
                            </button>
                            <button onClick={() => setArchiveConfirm(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setArchiveConfirm({ type: 'ejecucion', id: e.id })}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded transition-colors">
                            {e.archivado ? <Save size={11} /> : <Trash2 size={11} />} {e.archivado ? 'Desarchivar' : 'Archivar'}
                          </button>
                        )}
                      </div>
                      {/* Siempre mostrar comprobantes si existen */}
                      {cCount > 0 && (
                        <div className="mt-2">
                          <ComprobantesViewer comprobantes={e.comprobantes} onDelete={async (comp) => {
                            try {
                              if (comp.path) await deleteFile(comp.path);
                              const updated = e.comprobantes.filter((c: any) => c.id !== comp.id);
                              await updateEjecucion(companyId, e.id, { comprobantes: JSON.parse(JSON.stringify(updated)) });
                            } catch (err) {}
                          }} />
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            ));
          })()}</div>
        )}
      </div>

      {/* FOOTER */}
      <div className="shrink-0 p-6 border-t border-slate-100 bg-white">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
          <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase font-semibold">Presupuestado</span><span className="text-slate-700 font-bold">{formatCurrency(data.presupuestado)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase font-semibold">Ejecutado</span><span className="text-slate-700 font-bold">{formatCurrency(data.ejecutado)}</span></div>
          <div className="h-px bg-slate-200 w-full my-1" />
          <div className="flex justify-between text-sm font-bold">
            <span className="text-slate-700 uppercase text-[10px] tracking-wider">Diferencia</span>
            <span className={clsx("font-black text-lg", data.diferencia === 0 ? "text-slate-400" : (data.diferencia > 0 ? "text-emerald-600" : "text-rose-600"))}>{data.diferencia > 0 ? '+' : ''}{formatCurrency(data.diferencia)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
