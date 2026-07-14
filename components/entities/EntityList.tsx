'use client';

import { useState, useMemo } from 'react';
import type { Budget, Ejecucion, NavScreen } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { ComprobantesViewer } from '@/components/upload/ComprobantesViewer';
import { Eye, Pencil, Play, Archive, Trash2, Plus } from 'lucide-react';
import clsx from 'clsx';
import { groupByEntity } from '@/components/utils/groupByEntity';
import { EntityTypeBadge } from '@/components/shared/EntityTypeBadge';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] as const;
const MONTH_SET = new Set<string>(MONTHS);

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

/**
 * Parse the title to extract context depending on what kind of cell was clicked.
 *
 * Project cell:      title = "Admin / Febrero"          → { project: "Admin", month: "Febrero" }
 * Tercero cell:      title = "Admin / Cliente"          → { project: "Admin", entityName: "Cliente" }
 * Tercero month:     title = "Admin / Febrero / Cliente" → { project: "Admin", month: "Febrero", entityName: "Cliente" }
 * Row total:         title = "Total Admin"              → { project: "Admin" }
 * Col total:         title = "Total Febrero"            → { month: "Febrero" }
 * Grand total:       title = "TOTAL PERIODO VISIBLE"    → {}
 */
/** Convert month name ("Febrero") to YYYY-MM-DD ("2026-02-15") using the first record's year or current year */
function monthNameToDate(monthName: string, fallbackYear?: string): string {
  const idx = MONTHS.indexOf(monthName as typeof MONTHS[number]);
  if (idx === -1) return '';
  const year = fallbackYear || String(new Date().getFullYear());
  const m = String(idx + 1).padStart(2, '0');
  return `${year}-${m}-15`;
}

function parseCellTitle(title: string): { project?: string; month?: string; entityName?: string } {
  if (!title.includes(' / ')) return {};
  const parts = title.split(' / ');
  if (parts.length < 2) return {};

  // Three parts: "Admin / Febrero / Cliente" → tercero month cell
  if (parts.length >= 3) {
    return { project: parts[0], month: parts[1], entityName: parts[2] };
  }

  const [first, second] = parts;

  // If second part is a month name → project cell: "Admin / Febrero"
  if (MONTH_SET.has(second)) {
    return { project: first, month: second };
  }

  // Otherwise → tercero sub-row: "Admin / Cliente Uno"
  return { project: first, entityName: second };
}

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
    mode: 'archive' | 'delete';
    entity: 'budget' | 'ejecucion';
    record: any;
    data: { archivado: boolean } | Record<string, never>;
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
  const [confirmAction, setConfirmAction] = useState<{ action: 'archive' | 'delete'; type: 'budget' | 'ejecucion'; id: string; archived?: boolean } | null>(null);

  const handleArchive = async (type: 'budget' | 'ejecucion', record: Budget | Ejecucion, archived: boolean) => {
    try {
      await onSubmit({ mode: 'archive', entity: type, record, data: { archivado: archived } });
    } catch {
      // Errors handled upstream by the page.tsx handler
    }
    setConfirmAction(null);
  };

  const handleDelete = async (type: 'budget' | 'ejecucion', record: Budget | Ejecucion) => {
    try {
      await onSubmit({ mode: 'delete', entity: type, record, data: {} });
    } catch {
      // Errors handled upstream
    }
    setConfirmAction(null);
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
      <div className="flex-1 overflow-y-auto p-6 select-text">
        {mode === 'Presupuestado' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                Presupuestos ({budgets.length})
              </p>
              <button
                onClick={() => {
                  const ctx = parseCellTitle(title);
                  const firstBudget = budgets[0];
                  // If title has entityName (tercero sub-row), use it; otherwise fall back to first budget
                  const entityName = ctx.entityName || firstBudget?.entityName || '';
                  const entityId = (ctx.entityName
                    ? budgets.find(b => b.entityName === ctx.entityName)?.entityId
                    : firstBudget?.entityId) || '';
                  const entityType = (ctx.entityName
                    ? budgets.find(b => b.entityName === ctx.entityName)?.entityType
                    : firstBudget?.entityType) || '';
                  // Derive fecha from month context or existing budget
                  const budgetFallbackYear = firstBudget?.fechaPresupuestado?.split('-')[0];
                  const budgetFecha = ctx.month
                    ? monthNameToDate(ctx.month, budgetFallbackYear)
                    : (firstBudget?.fechaPresupuestado ? firstBudget.fechaPresupuestado + '-15' : '');
                  onNavigate({
                    type: 'entity',
                    entity: 'budget',
                    mode: 'create',
                    defaults: {
                      tipo,
                      projectName: ctx.project || firstBudget?.projectName || '',
                      projectId: firstBudget?.projectId || '',
                      entityName,
                      entityId,
                      entityType,
                      mesPresupuestado: ctx.month || firstBudget?.mesPresupuestado || '',
                      fechaEjecutado: budgetFecha,
                    },
                  });
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm px-3 py-1.5 rounded-lg transition-all hover:shadow-md"
              >
                <Plus size={13} /> Nuevo
              </button>
            </div>
            {budgets.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay presupuestos</p>
            ) : (
              renderBudgetGroups(budgets)
            )}
          </div>
        )}

        {mode === 'Ejecutado' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                Ejecuciones ({ejecuciones.length})
              </p>
              <button
                onClick={() => {
                  const ctx = parseCellTitle(title);
                  const firstEjec = ejecuciones[0];
                  const entityName = ctx.entityName || firstEjec?.entityName || '';
                  const entityId = (ctx.entityName
                    ? ejecuciones.find(e => e.entityName === ctx.entityName)?.entityId
                    : firstEjec?.entityId) || '';
                  const entityType = (ctx.entityName
                    ? ejecuciones.find(e => e.entityName === ctx.entityName)?.entityType
                    : firstEjec?.entityType) || '';
                  // Derive fecha from month context or existing ejecucion
                  const fallbackYear = firstEjec?.fechaEjecutado?.split('-')[0];
                  const fechaEjecutado = ctx.month
                    ? monthNameToDate(ctx.month, fallbackYear)
                    : firstEjec?.fechaEjecutado || '';
                  onNavigate({
                    type: 'entity',
                    entity: 'ejecucion',
                    mode: 'create',
                    defaults: {
                      tipo,
                      projectName: ctx.project || firstEjec?.projectName || '',
                      projectId: firstEjec?.projectId || '',
                      entityName,
                      entityId,
                      entityType,
                      fechaEjecutado,
                    },
                  });
                }}
                className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm px-3 py-1.5 rounded-lg transition-all hover:shadow-md"
              >
                <Plus size={13} /> Nueva
              </button>
            </div>
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
                <button onClick={() => onNavigate({ type: 'entity', entity: 'budget', mode: 'view', record: b })}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                  <Eye size={11} /> Ver
                </button>
                <button onClick={() => onNavigate({ type: 'entity', entity: 'budget', mode: 'edit', record: b })}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                  <Pencil size={11} /> Editar
                </button>
                <button onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'create', defaults: { projectId: b.projectId || '', projectName: b.projectName || '', entityId: b.entityId || '', entityName: b.entityName || '', entityType: b.entityType || 'client', tipo: b.tipo } })}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">
                  <Play size={11} /> Ejecutar
                </button>
                {renderRowActions('budget', b)}
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
                  <button onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'view', record: e })}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                    <Eye size={11} /> Ver
                  </button>
                  <button onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'edit', record: e })}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                    <Pencil size={11} /> Editar
                  </button>
                  {renderRowActions('ejecucion', e)}
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

  function renderRowActions(type: 'budget' | 'ejecucion', record: Budget | Ejecucion) {
    const isArchiving = confirmAction?.action === 'archive' && confirmAction?.type === type && confirmAction?.id === record.id;
    const isDeleting = confirmAction?.action === 'delete' && confirmAction?.type === type && confirmAction?.id === record.id;

    if (isArchiving) {
      return (
        <div className="flex items-center gap-1">
          <button onClick={() => handleArchive(type, record, !(record as any).archivado)}
            className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded transition-colors">
            Confirmar
          </button>
          <button onClick={() => setConfirmAction(null)}
            className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1">
            Cancelar
          </button>
        </div>
      );
    }

    if (isDeleting) {
      return (
        <div className="flex items-center gap-1">
          <button onClick={() => handleDelete(type, record)}
            className="flex items-center gap-1 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors">
            Confirmar
          </button>
          <button onClick={() => setConfirmAction(null)}
            className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1">
            Cancelar
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <button onClick={() => setConfirmAction({ action: 'archive', type, id: record.id, archived: !(record as any).archivado })}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 px-2 py-1 rounded transition-colors">
          <Archive size={11} />
          {(record as any).archivado ? 'Desarchivar' : 'Archivar'}
        </button>
        <button onClick={() => setConfirmAction({ action: 'delete', type, id: record.id })}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded transition-colors">
          <Trash2 size={11} />
          Eliminar
        </button>
      </div>
    );
  }
}
