'use client';

import { useState } from 'react';
import type { Budget, Ejecucion, NavScreen } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { ComprobantesViewer } from '@/components/upload/ComprobantesViewer';
import { FileText, Plus, Save, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { groupByEntity } from '@/components/utils/groupByEntity';
import { EntityTypeBadge } from '@/components/shared/EntityTypeBadge';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export interface EntityListProps {
  mode: 'Presupuestado' | 'Ejecutado';
  tipo: 'ingreso' | 'egreso';
  title: string;
  subtitle: string;
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  presupuestado: number;
  ejecutado: number;
  diferencia: number;
  onNavigate: (screen: NavScreen) => void;
  onClose?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  onSubmit: (action: {
    mode: 'archive';
    entity: 'budget' | 'ejecucion';
    record: any;
    data: { archivado: boolean };
  }) => Promise<void>;
}

export function EntityList({
  mode,
  tipo,
  title,
  subtitle,
  budgets,
  ejecuciones,
  presupuestado,
  ejecutado,
  diferencia,
  onNavigate,
  onClose,
  onBack,
  canGoBack = false,
  onSubmit,
}: EntityListProps) {
  const [archiveConfirm, setArchiveConfirm] = useState<{ type: 'budget' | 'ejecucion'; id: string } | null>(null);

  const handleArchive = async (type: 'budget' | 'ejecucion', record: Budget | Ejecucion, archived: boolean) => {
    try {
      await onSubmit({ mode: 'archive', entity: type, record, data: { archivado: archived } });
    } catch {
      // Errors handled upstream by the page.tsx handler
    }
    setArchiveConfirm(null);
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader
        title={`Detalle de ${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ${mode === 'Presupuestado' ? 'Presupuestado' : 'Ejecutado'}`}
        canGoBack={canGoBack}
        onBack={onBack || (() => {})}
        onClose={onClose || (() => {})}
      />
      <div className="px-5 py-3">
        <div className={clsx('rounded-xl p-4 border', mode === 'Presupuestado' ? 'bg-sky-50 border-sky-100 text-sky-900' : 'bg-slate-800 border-slate-700 text-white')}>
          <p className={clsx('text-[10px] font-bold uppercase tracking-widest', mode === 'Presupuestado' ? 'text-sky-600' : 'text-slate-400')}>Seleccionado</p>
          <p className="text-sm font-bold mt-1">{title}</p>
          <p className="text-xs mt-1 opacity-80">{subtitle}</p>
        </div>
      </div>

      {/* BODY — scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'Presupuestado' && (
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
              Presupuestos ({budgets.length})
            </p>
            {budgets.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay presupuestos</p>
            ) : (
              renderBudgetGroups(budgets)
            )}
          </div>
        )}

        {mode === 'Ejecutado' && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
              Ejecuciones ({ejecuciones.length})
            </p>
            {ejecuciones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay ejecuciones</p>
            ) : (
              renderEjecucionGroups(ejecuciones)
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="shrink-0 p-6 border-t border-slate-100 bg-white">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 uppercase font-semibold">Presupuestado</span>
            <span className="text-slate-700 font-bold">{formatCurrency(presupuestado)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 uppercase font-semibold">Ejecutado</span>
            <span className="text-slate-700 font-bold">{formatCurrency(ejecutado)}</span>
          </div>
          <div className="h-px bg-slate-200 w-full my-1" />
          <div className="flex justify-between text-sm font-bold">
            <span className="text-slate-700 uppercase text-[10px] tracking-wider">Diferencia</span>
            <span
              className={clsx(
                'font-black text-lg',
                diferencia === 0 ? 'text-slate-400' : diferencia > 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {diferencia > 0 ? '+' : ''}
              {formatCurrency(diferencia)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  function renderBudgetGroups(items: Budget[]) {
    const grouped = groupByEntity(items).map(g => ({
      ...g,
      total: g.items.reduce((sum, b) => sum + b.montoPresupuestado, 0),
    }));
    const sorted = [...grouped].sort((a, b) => a.entityName.localeCompare(b.entityName));
    return sorted.map(group => (
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
            <div key={b.id} className="px-2 py-1.5">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs font-semibold text-slate-700 truncate">{b.descripcion}</p>
                  <p className="text-[10px] text-slate-400">{b.mesPresupuestado}</p>
                </div>
                <p className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(b.montoPresupuestado)}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <button
                  onClick={() => onNavigate({ type: 'entity', entity: 'budget', mode: 'view', record: b })}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                >
                  <FileText size={11} /> Ver
                </button>
                <button
                  onClick={() => onNavigate({ type: 'entity', entity: 'budget', mode: 'edit', record: b })}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                >
                  <Save size={11} /> Editar
                </button>
                <button
                  onClick={() =>
                    onNavigate({
                      type: 'entity',
                      entity: 'ejecucion',
                      mode: 'create',
                      defaults: {
                        projectId: b.projectId || '',
                        projectName: b.projectName || '',
                        entityId: b.entityId || '',
                        entityName: b.entityName || '',
                        entityType: b.entityType || 'client',
                        tipo: b.tipo,
                      },
                    })
                  }
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={11} /> Ejecutar
                </button>
                {renderArchiveActions('budget', b)}
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  }

  function renderEjecucionGroups(items: Ejecucion[]) {
    const grouped = groupByEntity(items).map(g => ({
      ...g,
      total: g.items.reduce((sum, e) => sum + e.montoEjecutado, 0),
    }));
    const sorted = [...grouped].sort((a, b) => a.entityName.localeCompare(b.entityName));
    return sorted.map(group => (
      <div key={group.entityName} className="mb-3 last:mb-0">
        <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
            <EntityTypeBadge type={group.entityType} />
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
                  <button
                    onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'view', record: e })}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                  >
                    <FileText size={11} /> Ver
                  </button>
                  <button
                    onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'edit', record: e })}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                  >
                    <Save size={11} /> Editar
                  </button>
                  {renderArchiveActions('ejecucion', e)}
                </div>
                {/* Comprobantes inline */}
                {cCount > 0 && (
                  <div className="mt-2">
                    <ComprobantesViewer comprobantes={e.comprobantes} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ));
  }

  function renderArchiveActions(type: 'budget' | 'ejecucion', record: Budget | Ejecucion) {
    const isConfirming = archiveConfirm?.type === type && archiveConfirm?.id === record.id;
    return isConfirming ? (
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleArchive(type, record, !(record as any).archivado)}
          className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded transition-colors"
        >
          Confirmar
        </button>
        <button
          onClick={() => setArchiveConfirm(null)}
          className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1"
        >
          Cancelar
        </button>
      </div>
    ) : (
      <button
        onClick={() => setArchiveConfirm({ type, id: record.id })}
        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
      >
        {(record as any).archivado ? <Save size={11} /> : <Trash2 size={11} />}
        {(record as any).archivado ? 'Desarchivar' : 'Archivar'}
      </button>
    );
  }
}
