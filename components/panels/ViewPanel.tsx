'use client';

import React from 'react';
import { RecordDetail, Project, SidepanelData, ActiveForm, NavScreen } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { DF } from '@/components/shared/DF';
import { TerceroGroupPanel } from '@/components/panels/TerceroGroupPanel';
import { SettingsEditor } from '@/components/shared/SettingsEditor';
import { ProjectView } from '@/components/views/ProjectView';
import { BudgetView } from '@/components/views/BudgetView';
import { EjecucionView } from '@/components/views/EjecucionView';
import { Save } from 'lucide-react';
import clsx from 'clsx';

interface ViewPanelProps {
  recordDetail: RecordDetail;
  companyId: string;
  onClose: () => void;
  onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>;
  onCellClick?: (data: SidepanelData) => void;
  projects?: Project[];
  onNavigate: (screen: NavScreen) => void;
  canGoBack: boolean;
  onBack: () => void;
}

export function ViewPanel({ recordDetail, companyId, onClose, onFormSubmit, onCellClick, projects, onNavigate, canGoBack, onBack }: ViewPanelProps) {
  const title = recordDetail.type === 'budget' ? 'Presupuesto' : recordDetail.type === 'ejecucion' ? 'Ejecución'
    : recordDetail.type === 'project' ? 'Proyecto' : recordDetail.type === 'client' ? 'Cliente'
    : recordDetail.type === 'provider' ? 'Proveedor' : recordDetail.type === 'tercero' ? 'Tercero' : '';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {recordDetail.type === 'budget' && <BudgetView budget={recordDetail.budget} ejecuciones={recordDetail.ejecuciones} companyId={companyId} onClose={onClose} onFormSubmit={onFormSubmit} onNavigate={onNavigate} />}
        {recordDetail.type === 'ejecucion' && <EjecucionView ejecucion={recordDetail.ejecucion} companyId={companyId} onClose={onClose} onNavigate={onNavigate} />}
        {recordDetail.type === 'project' && <ProjectView project={recordDetail.project} budgets={recordDetail.budgets} ejecuciones={recordDetail.ejecuciones} companyId={companyId} projects={projects} onFormSubmit={onFormSubmit} onNavigate={onNavigate} />}
        {recordDetail.type === 'client' && (<><DF label="Nombre" v={recordDetail.client.name} />
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Proyectos ({recordDetail.projects.length})</p>{recordDetail.projects.map(p => <div key={p.id} className="flex justify-between text-xs bg-slate-50 p-2 rounded mb-1"><span>{p.name}</span><span className="font-bold">{p.estado}</span></div>)}</div>
        </>)}
        {recordDetail.type === 'provider' && <DF label="Nombre" v={recordDetail.provider.name} />}
        {recordDetail.type === 'tercero' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Tercero</p>
              <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'tercero', record: recordDetail.tercero } })}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                <Save size={12} /> Editar
              </button>
            </div>
            <DF label="Nombre" v={recordDetail.tercero.name} />
            {recordDetail.tercero.apodo && <DF label="Apodo" v={recordDetail.tercero.apodo} />}
            {recordDetail.tercero.naturaleza && <DF label="Naturaleza" v={recordDetail.tercero.naturaleza} />}
            {recordDetail.tercero.documento && recordDetail.tercero.numeroDocumento && (
              <DF label="Documento" v={`${recordDetail.tercero.documento} ${recordDetail.tercero.numeroDocumento}`} />
            )}
            {recordDetail.tercero.lugar && <DF label="Lugar" v={recordDetail.tercero.lugar} />}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</p>
              <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                recordDetail.tercero.tipo === 'cliente' ? 'bg-blue-100 text-blue-700' :
                recordDetail.tercero.tipo === 'proveedor' ? 'bg-amber-100 text-amber-700' :
                'bg-purple-100 text-purple-700'
              )}>
                {recordDetail.tercero.tipo === 'cliente' ? 'Cliente' : recordDetail.tercero.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}
              </span>
            </div>
          </>
        )}
        {recordDetail.type === 'detalle-tercero' && (
          <TerceroGroupPanel projects={recordDetail.projects} onCellClick={onCellClick} mode="Presupuestado" />
        )}
        {recordDetail.type === 'settings-editor' && (
          <SettingsEditor category={recordDetail.category} title={recordDetail.title} items={recordDetail.items}
            companyId={companyId} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
