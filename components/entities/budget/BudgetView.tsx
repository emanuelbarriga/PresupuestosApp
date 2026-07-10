'use client';

import { useState, useEffect } from 'react';
import type { Budget, Ejecucion, NavScreen, EntityType } from '@/lib/types';
import { subscribeEjecucionesByBudget } from '@/lib/firestore';
import { DF } from '@/components/shared/DF';
import { Plus } from 'lucide-react';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface BudgetViewProps {
  budget: Budget;
  companyId: string;
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => Promise<void>;
  onNavigate: (screen: NavScreen) => void;
}

export function BudgetView({ budget, companyId, onSubmit, onNavigate }: BudgetViewProps) {
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);

  // Live subscription to linked ejecuciones — only active while component is mounted (view mode)
  useEffect(() => {
    const unsub = subscribeEjecucionesByBudget(companyId, budget.id, (linkedEjecuciones) => {
      setEjecuciones(linkedEjecuciones);
    });
    return () => unsub();
  }, [companyId, budget.id]);

  const handleNavigateToEjecucionCreate = () => {
    onNavigate({
      type: 'entity',
      entity: 'ejecucion',
      mode: 'create',
      defaults: {
        descripcion: `Ejecución: ${budget.descripcion}`,
        projectId: budget.projectId || '',
        projectName: budget.projectName || '',
        entityId: budget.entityId || '',
        entityName: budget.entityName || '',
        entityType: budget.entityType || '',
        tipo: budget.tipo,
      },
    });
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
          <button onClick={handleNavigateToEjecucionCreate} className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">
            <Plus size={12} /> Agregar
          </button>
        </div>
        {ejecuciones.map((e) => (
          <div key={e.id} onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'view', record: e })} className="flex justify-between text-xs bg-slate-50 hover:bg-indigo-50 p-2 rounded mb-1 cursor-pointer transition-colors">
            <span className="text-slate-600">{e.fechaEjecutado} - {e.descripcion}</span>
            <span className="font-bold text-slate-700">{formatCurrency(e.montoEjecutado)}</span>
          </div>
        ))}
        {ejecuciones.length === 0 && <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin ejecuciones</p>}
      </div>
    </>
  );
}
