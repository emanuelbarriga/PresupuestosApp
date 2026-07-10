'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { EntityProps, MovimientoBancario, Project, Tercero } from '@/lib/types';
import { subscribeProjects, subscribeTerceros, addEjecucion, updateMovimiento } from '@/lib/firestore';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { ArrowRight, CheckSquare, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export function ConvertirMovimientosEntity({ mode, companyId, record, defaults, onClose, onBack, canGoBack }: EntityProps) {
  const movimientos = (Array.isArray(record) ? record : []) as MovimientoBancario[];
  const cuentaId = defaults?.cuentaId ?? '';
  const cuentaName = defaults?.cuentaName ?? '';
  const extractoId = defaults?.extractoId ?? '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [entityType, setEntityType] = useState<'client' | 'provider' | 'interno' | ''>('');
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Subscribe to reference data
  useEffect(() => {
    const unsubs = [
      subscribeProjects(companyId, setProjects, () => {}),
      subscribeTerceros(setTerceros, () => {}),
    ];
    return () => unsubs.forEach(u => u());
  }, [companyId]);

  // Infer default tipo from movements
  useEffect(() => {
    if (movimientos.length === 0) return;
    const hasDebito = movimientos.some(m => m.debito != null && m.debito > 0);
    const hasCredito = movimientos.some(m => m.credito != null && m.credito > 0);
    if (hasDebito && !hasCredito) setTipo('egreso');
    else if (!hasDebito && hasCredito) setTipo('ingreso');
    // If mixed, keep default 'egreso'
  }, [movimientos]);

  // Initialize descriptions from movements
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const m of movimientos) {
      initial[m.id] = m.descripcion;
    }
    setDescriptions(initial);
  }, [movimientos]);

  const projectOptions = useMemo(
    () => projects.map(p => ({ value: p.id, label: `${p.name}${p.descripcion ? ` — ${p.descripcion}` : ''}` })),
    [projects],
  );

  const terceroOptions = useMemo(
    () => terceros.map(t => ({
      value: t.id,
      label: `${t.name}${t.apodo ? ` (${t.apodo})` : ''} — ${t.tipo === 'cliente' ? 'Cliente' : t.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}`,
    })),
    [terceros],
  );

  const handleProjectSelect = (v: string) => {
    const found = projects.find(p => p.id === v);
    setProjectId(v);
    setProjectName(found?.name ?? '');
  };

  const handleTerceroSelect = (v: string) => {
    const found = terceros.find(t => t.id === v);
    setEntityId(v);
    setEntityName(found?.name ?? '');
    if (found) {
      setEntityType(found.tipo === 'cliente' || found.tipo === 'ambos' ? 'client' : 'provider');
    }
  };

  const setDesc = (id: string, val: string) => {
    setDescriptions(prev => ({ ...prev, [id]: val }));
  };

  const totalDebito = useMemo(
    () => movimientos.reduce((s, m) => s + (m.debito ?? 0), 0),
    [movimientos],
  );
  const totalCredito = useMemo(
    () => movimientos.reduce((s, m) => s + (m.credito ?? 0), 0),
    [movimientos],
  );

  const handleConvertir = async () => {
    if (!projectId) {
      toast.error('Seleccioná un proyecto');
      return;
    }
    if (!entityId) {
      toast.error('Seleccioná un tercero');
      return;
    }

    setSaving(true);
    let ok = 0;
    let fail = 0;

    for (const mov of movimientos) {
      const isDebito = mov.debito != null && mov.debito > 0;
      const monto = isDebito ? mov.debito! : mov.credito ?? 0;
      const desc = descriptions[mov.id]?.trim() || mov.descripcion;

      try {
        const ejecucionId = await addEjecucion(companyId, {
          descripcion: desc,
          fechaEjecutado: mov.fecha,
          montoEjecutado: monto,
          projectId,
          projectName,
          entityId,
          entityName,
          entityType,
          tipo: isDebito ? 'egreso' : tipo,
          cuentaId,
          cuentaName,
          comprobantes: [],
        });

        if (extractoId) {
          await updateMovimiento(companyId, cuentaId, extractoId, mov.id, { convertido: true, _ejecucionId: ejecucionId });
        }
        ok++;
      } catch {
        fail++;
      }
    }

    setSaving(false);

    if (fail === 0) {
      toast.success(`${ok} ejecucion${ok !== 1 ? 'es' : ''} creada${ok !== 1 ? 's' : ''} correctamente`);
      onClose();
    } else {
      toast.error(`${fail} error${fail !== 1 ? 'es' : ''} — ${ok} creada${ok !== 1 ? 's' : ''} correctamente`);
    }
  };

  if (movimientos.length === 0) {
    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0">
        <PanelHeader title="Convertir a Ejecuciones" canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-400 italic">No hay movimientos seleccionados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={`Convertir ${movimientos.length} movimientos`} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Common fields */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-3">
          <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Campos comunes</p>

          <SearchableSelect
            label="Proyecto"
            value={projectId}
            onChange={handleProjectSelect}
            options={projectOptions}
            placeholder="Buscar proyecto..."
          />

          <SearchableSelect
            label="Cliente / Proveedor"
            value={entityId}
            onChange={handleTerceroSelect}
            options={terceroOptions}
            placeholder="Buscar tercero..."
          />

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
            <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5 w-fit">
              {(['egreso', 'ingreso'] as const).map(t => (
                <button key={t}
                  onClick={() => setTipo(t)}
                  className={clsx(
                    "px-3 py-1.5 text-[11px] font-bold rounded-md transition-all",
                    tipo === t
                      ? (t === 'egreso' ? 'bg-rose-500 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm')
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {t === 'egreso' ? 'Egreso' : 'Ingreso'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-500">
            Cuenta: <span className="font-semibold text-slate-700">{cuentaName || cuentaId}</span>
          </div>
        </div>

        {/* Movements list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Movimientos ({movimientos.length})
            </p>
            <div className="flex gap-3 text-[10px] text-slate-500">
              {totalDebito > 0 && <span className="text-rose-600 font-semibold">D: {formatCurrency(totalDebito)}</span>}
              {totalCredito > 0 && <span className="text-emerald-600 font-semibold">C: {formatCurrency(totalCredito)}</span>}
            </div>
          </div>

          <div className="space-y-2">
            {movimientos.map((mov) => {
              const isDebito = mov.debito != null && mov.debito > 0;
              const monto = isDebito ? mov.debito! : mov.credito ?? 0;
              return (
                <div key={mov.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">{mov.fecha}</span>
                    <span className={clsx(
                      "text-[11px] font-bold tabular-nums",
                      isDebito ? 'text-rose-600' : 'text-emerald-600',
                    )}>
                      {formatCurrency(monto)}
                    </span>
                  </div>
                  <div className="relative">
                    <Pencil size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={descriptions[mov.id] ?? ''}
                      onChange={e => setDesc(mov.id, e.target.value)}
                      className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1.5 text-[11px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer with Convertir button */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleConvertir}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl py-2.5 text-xs font-bold transition-colors"
        >
          {saving ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creando ejecuciones...
            </>
          ) : (
            <>
              <ArrowRight size={14} />
              Convertir {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
