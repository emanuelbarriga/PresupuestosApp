'use client'

import { useState, useEffect } from 'react';
import { Budget, Ejecucion, ActiveForm, NavScreen } from '@/lib/types';
import { subscribeEjecucionesByBudget } from '@/lib/firestore';
import { DF } from '@/components/shared/DF';
import { FormInput } from '@/components/forms/FormInput';
import { Plus } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

export function BudgetView({ budget, ejecuciones: initialEjecuciones, companyId, onClose, onFormSubmit, onNavigate }: {
  budget: Budget; ejecuciones: Ejecucion[]; companyId: string; onClose: () => void; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; onNavigate: (screen: NavScreen) => void;
}) {
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>(initialEjecuciones);
  const [addingEj, setAddingEj] = useState(false);
  const [ejForm, setEjForm] = useState({ descripcion: '', montoEjecutado: '', fechaEjecutado: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  // Subscribe via collectionGroup to get live linked ejecuciones
  useEffect(() => {
    const unsub = subscribeEjecucionesByBudget(companyId, budget.id, (linkedEjecuciones) => {
      setEjecuciones(linkedEjecuciones);
    });
    return () => unsub();
  }, [companyId, budget.id]);

  const handleAddEj = async () => {
    setSaving(true);
    await onFormSubmit(
      { mode: 'add', type: 'ejecucion' },
      {
        descripcion: ejForm.descripcion || `Ejecución: ${budget.descripcion}`,
        projectId: budget.projectId || '',
        projectName: budget.projectName || '',
        entityId: budget.entityId || '',
        entityName: budget.entityName || '',
        entityType: budget.entityType || '',
        tipo: budget.tipo,
        montoEjecutado: Number(ejForm.montoEjecutado) || 0,
        fechaEjecutado: ejForm.fechaEjecutado,
      },
    );
    setSaving(false);
    setAddingEj(false);
  };

  return (
    <>
      <DF label="Descripción" v={budget.descripcion} />
      <DF label="Proyecto" v={budget.projectName} />
      <DF label="Cliente/Proveedor" v={budget.entityName} />
      <DF label="Tipo" v={budget.tipo} />
      <DF label="Monto Presupuestado" v={formatCurrency(budget.montoPresupuestado)} />
      <DF label="Mes" v={budget.mesPresupuestado} />
      <DF label="Estado" v={budget.estadoProyecto} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Ejecuciones ({ejecuciones.length})</p>
          <button onClick={() => setAddingEj(!addingEj)} className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">
            <Plus size={12} /> {addingEj ? 'Cancelar' : 'Agregar'}
          </button>
        </div>
        {ejecuciones.map((e) => (
          <div key={e.id} onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: e } })} className="flex justify-between text-xs bg-slate-50 hover:bg-indigo-50 p-2 rounded mb-1 cursor-pointer transition-colors">
            <span className="text-slate-600">{e.fechaEjecutado} - {e.descripcion}</span>
            <span className="font-bold text-slate-700">{formatCurrency(e.montoEjecutado)}</span>
          </div>
        ))}
        {ejecuciones.length === 0 && <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin ejecuciones</p>}
      </div>

      {addingEj && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Nueva ejecución vinculada</p>
          <FormInput label="Descripción" value={ejForm.descripcion} onChange={v => setEjForm(p => ({ ...p, descripcion: v }))} />
          <FormInput label="Monto" value={ejForm.montoEjecutado} onChange={v => setEjForm(p => ({ ...p, montoEjecutado: v }))} type="number" />
          <FormInput label="Fecha" value={ejForm.fechaEjecutado} onChange={v => setEjForm(p => ({ ...p, fechaEjecutado: v }))} type="date" />
          <button onClick={handleAddEj} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg py-2 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : 'Guardar Ejecución'}
          </button>
        </div>
      )}
    </>
  );
}
