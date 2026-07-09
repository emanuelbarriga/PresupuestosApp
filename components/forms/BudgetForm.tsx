'use client';

import React, { useState } from 'react';
import type { Project, CuentaBancaria, SettingsCategorias } from '@/lib/types';
import { MONTHS, type Month } from '@/lib/types';
import { FormInput } from '@/components/forms/FormInput';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { TipoSwitch } from '@/components/forms/TipoSwitch';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { formatThousands, unformatThousands } from '@/lib/utils';
import { Calculator } from '@/components/shared/Calculator';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { addClient, addProject } from '@/lib/firestore';

interface BudgetFormProps {
  form: { mode: 'add' | 'edit'; type: 'budget'; record?: any; defaults?: Record<string, string> };
  companyId: string;
  title: string;
  projects: Project[];
  clients: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string }>;
  clientsAndProviders: Array<{ value: string; label: string; type: string }>;
  settingsData: SettingsCategorias | null;
  onSubmit: (form: any, data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
}

interface BudgetFields {
  tipo: string;
  projectId: string;
  projectName: string;
  entityId: string;
  entityName: string;
  entityType: string;
  descripcion: string;
  montoPresupuestado: string;
  fechaEjecutado: string;
  mesPresupuestado: string;
  fechaPresupuestado: string;
}

export function BudgetForm({
  form,
  companyId,
  title,
  projects,
  clients,
  providers,
  clientsAndProviders,
  settingsData,
  onSubmit,
  onBack,
  onClose,
  saving: externalSaving,
}: BudgetFormProps) {
  const [fields, setFields] = useState<BudgetFields>(() => {
    if (form.mode === 'edit' && form.record) {
      const r = form.record as any;
      return {
        tipo: String(r.tipo ?? 'ingreso'),
        projectId: String(r.projectId ?? ''),
        projectName: String(r.projectName ?? ''),
        entityId: String(r.entityId ?? ''),
        entityName: String(r.entityName ?? 'Interno'),
        entityType: String(r.entityType ?? 'interno'),
        descripcion: String(r.descripcion ?? ''),
        montoPresupuestado: String(r.montoPresupuestado ?? ''),
        fechaEjecutado: String(r.fechaEjecutado ?? ''),
        mesPresupuestado: String(r.mesPresupuestado ?? ''),
        fechaPresupuestado: String(r.fechaPresupuestado ?? ''),
      };
    }
    const defs = form.defaults || {};
    return {
      tipo: defs.tipo ?? 'ingreso',
      projectId: defs.projectId ?? '',
      projectName: defs.projectName ?? '',
      entityId: defs.entityId ?? '',
      entityName: defs.entityName ?? 'Interno',
      entityType: defs.entityType ?? 'interno',
      descripcion: defs.descripcion ?? '',
      montoPresupuestado: defs.montoPresupuestado ?? '',
      fechaEjecutado: defs.fechaEjecutado ?? '',
      mesPresupuestado: defs.mesPresupuestado ?? '',
      fechaPresupuestado: defs.fechaPresupuestado ?? '',
    };
  });

  const [showCalc, setShowCalc] = useState(false);
  const [montoEditing, setMontoEditing] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(3);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const safeProjects = projects || [];
  const set = (k: keyof BudgetFields, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const handleDateChange = (date: string) => {
    set('fechaEjecutado', date);
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        set('mesPresupuestado', MONTHS[parseInt(parts[1], 10) - 1] || '');
        set('fechaPresupuestado', parts[0] + '-' + parts[1]);
      }
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const newId = await addProject(companyId, { name: newProjectName.trim(), clientName: newProjectClient.trim() || 'Sin cliente', clientId: '', estado: 'Activo' });
    set('projectId', newId);
    set('projectName', newProjectName.trim());
    setNewProjectName('');
    setNewProjectClient('');
    setShowNewProject(false);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const newId = await addClient({ name: newClientName.trim() });
    set('entityId', newId);
    set('entityName', newClientName.trim());
    set('entityType', 'client');
    setNewClientName('');
    setShowNewClient(false);
  };

  const addMonth = (monthName: string, count: number): string => {
    const idx = MONTHS.indexOf(monthName as Month);
    return MONTHS[(idx + count) % 12];
  };
  const addMonthToDate = (dateStr: string, count: number): string => {
    if (!dateStr) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (m < 1 || m > 12) return dateStr;
    m += count;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    return `${y}-${String(m).padStart(2, '0')}-${parts[2]}`;
  };
  const addMonthToYM = (ymStr: string, count: number): string => {
    if (!ymStr) return ymStr;
    const parts = ymStr.split('-');
    if (parts.length !== 2) return ymStr;
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (m < 1 || m > 12) return ymStr;
    m += count;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    const data: Record<string, any> = { ...fields };
    // Strip empty optional fields to match legacy Sidepanel behavior (test expects undefined, not '')
    if (!data.mesPresupuestado) delete data.mesPresupuestado;
    if (!data.fechaPresupuestado) delete data.fechaPresupuestado;

    // Save the year from fechaEjecutado BEFORE deleting it (used as fallback for recurring)
    const yearFromDate = data.fechaEjecutado
      ? parseInt((data.fechaEjecutado as string).split('-')[0], 10)
      : null;

    const entries: Record<string, any>[] = [];
    const reps = recurring && form.mode === 'add' ? Math.max(1, recurringCount) : 1;

    for (let i = 0; i < reps; i++) {
      const entry = { ...data };
      if (!entry.projectId) entry.projectId = '';
      if (!entry.projectName) entry.projectName = '';
      if (!entry.entityId) entry.entityId = '';
      if (!entry.entityName) entry.entityName = 'Interno';
      if (!entry.entityType) entry.entityType = 'interno';
      entry.montoPresupuestado = Number(entry.montoPresupuestado) || 0;
      delete entry.fechaEjecutado;

      // Ensure fechaPresupuestado from mesPresupuestado
      if (entry.mesPresupuestado && !entry.fechaPresupuestado) {
        const monthIdx = MONTHS.indexOf(entry.mesPresupuestado as Month);
        if (monthIdx >= 0) {
          const year = yearFromDate || new Date().getFullYear();
          entry.fechaPresupuestado = `${isNaN(year) ? new Date().getFullYear() : year}-${String(monthIdx + 1).padStart(2, '0')}`;
        }
      }

      if (i > 0) {
        entry.mesPresupuestado = addMonth(entry.mesPresupuestado, i);
        entry.fechaPresupuestado = addMonthToYM(entry.fechaPresupuestado || `${yearFromDate || new Date().getFullYear()}-01`, i);
      }
      entries.push(entry);
    }

    for (const entry of entries) {
      await onSubmit(form, entry);
    }
    onBack();
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <TipoSwitch value={fields.tipo} onChange={v => set('tipo', v)} />
        <SearchableSelect label="Proyecto" value={fields.projectId || fields.projectName} onChange={v => {
          const p = safeProjects.find(p => p.id === v);
          if (p) { set('projectId', p.id); set('projectName', p.name); }
        }} options={safeProjects.map(p => ({ value: p.id, label: p.name }))} placeholder="Buscar proyecto..." />
        {!showNewProject && (
          <button onClick={() => setShowNewProject(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo proyecto
          </button>
        )}
        {showNewProject && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nombre del proyecto" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <input type="text" value={newProjectClient} onChange={e => setNewProjectClient(e.target.value)} placeholder="Cliente (opcional)" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateProject} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewProject(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <SearchableSelect label="Cliente / Proveedor" value={fields.entityId || fields.entityName} onChange={v => {
          if (!v) { set('entityId', ''); set('entityName', 'Interno'); set('entityType', 'interno'); return; }
          const allEntities = [...clients.map(c => ({ id: c.id, name: c.name, type: 'client' as const })), ...providers.map(p => ({ id: p.id, name: p.name, type: 'provider' as const }))];
          const entity = allEntities.find(e => e.id === v);
          if (entity) { set('entityId', entity.id); set('entityName', entity.name); set('entityType', entity.type); }
        }} options={clientsAndProviders} placeholder="Buscar cliente o proveedor..." />
        {!showNewClient && (
          <button onClick={() => setShowNewClient(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo cliente
          </button>
        )}
        {showNewClient && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del cliente" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleCreateClient} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewClient(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <FormInput label="Descripción" value={fields.descripcion} onChange={v => set('descripcion', v)} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Monto Presupuestado</label>
            <button type="button" onClick={() => { setShowCalc(!showCalc); if (!showCalc) setCalcExpr(fields.montoPresupuestado || ''); }}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">
              🧮 Calc
            </button>
          </div>
          <input type="text" inputMode="numeric"
            value={montoEditing ? unformatThousands(fields.montoPresupuestado) : formatThousands(fields.montoPresupuestado)}
            onFocus={() => setMontoEditing(true)}
            onBlur={() => setMontoEditing(false)}
            onChange={e => set('montoPresupuestado', unformatThousands(e.target.value))}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-right" />
          {showCalc && (
            <Calculator value={calcExpr} onChange={setCalcExpr} onResult={(res) => {
              set('montoPresupuestado', String(res));
              setShowCalc(false);
            }} />
          )}
        </div>
        <div>
          <FormInput label="Fecha del presupuesto" value={fields.fechaEjecutado} onChange={handleDateChange} type="date" />
          {fields.mesPresupuestado && <p className="text-[11px] text-indigo-600 font-medium mt-1">Mes calculado: {fields.mesPresupuestado}</p>}
        </div>

        {form.mode === 'add' && (
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 mb-3">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-xs font-medium text-slate-600 select-none">Recurrente</span>
            </label>
            {recurring && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 shrink-0">Repetir por</span>
                <input type="number" min={1} max={60} value={recurringCount} onChange={e => setRecurringCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-slate-200 rounded-lg p-1.5 text-sm text-center focus:border-indigo-500 outline-none bg-white" />
                <span className="text-[11px] font-medium text-slate-500 shrink-0">meses</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSubmit} disabled={externalSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {externalSaving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
