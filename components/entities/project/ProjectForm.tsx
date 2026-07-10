'use client';

import React, { useState } from 'react';
import type { Project, Tercero, SettingsCategorias } from '@/lib/types';
import { FormInput } from '@/components/forms/FormInput';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { ColorSelect } from '@/components/forms/ColorSelect';
import { Plus } from 'lucide-react';
import { addTercero } from '@/lib/firestore';

export interface ProjectFormData {
  name: string;
  descripcion: string;
  tipoProyectos: string;
  cantidad: string;
  unidades: string;
  clientId: string;
  clientName: string;
  estado: string;
  soloEgresos: string;
  soloIngresos: string;
}

interface ProjectFormProps {
  mode: 'add' | 'edit';
  record?: Project;
  defaults?: Record<string, string>;
  companyId: string;
  terceros: Tercero[];
  settingsData: SettingsCategorias | null;
  onFormSubmit: (data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
}

export function ProjectForm({
  mode,
  record,
  defaults,
  terceros,
  settingsData,
  onFormSubmit,
  onBack,
  onClose,
  saving,
}: ProjectFormProps) {
  const [fields, setFields] = useState<ProjectFormData>(() => {
    if (mode === 'edit' && record) {
      const r = record as any;
      return {
        name: String(r.name ?? ''),
        descripcion: String(r.descripcion ?? ''),
        tipoProyectos: String(r.tipoProyectos ?? ''),
        cantidad: String(r.cantidad ?? ''),
        unidades: String(r.unidades ?? ''),
        clientId: String(r.clientId ?? ''),
        clientName: String(r.clientName ?? ''),
        estado: String(r.estado ?? ''),
        soloEgresos: String(r.soloEgresos === true ? 'true' : ''),
        soloIngresos: String(r.soloIngresos === true ? 'true' : ''),
      };
    }
    const defs = defaults || {};
    return {
      name: defs.name ?? '',
      descripcion: defs.descripcion ?? '',
      tipoProyectos: defs.tipoProyectos ?? '',
      cantidad: defs.cantidad ?? '',
      unidades: defs.unidades ?? '',
      clientId: defs.clientId ?? '',
      clientName: defs.clientName ?? '',
      estado: defs.estado ?? '',
      soloEgresos: defs.soloEgresos ?? '',
      soloIngresos: defs.soloIngresos ?? '',
    };
  });

  const [customTipo, setCustomTipo] = useState('');
  const [customUnidad, setCustomUnidad] = useState('');
  const [showNewProjectClient, setShowNewProjectClient] = useState(false);
  const [newProjectClientName, setNewProjectClientName] = useState('');

  const set = (k: keyof ProjectFormData, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const clientOptions = terceros
    .filter(t => t.tipo === 'cliente' || t.tipo === 'ambos')
    .map(t => ({ value: t.id, label: t.name + (t.apodo ? ` (${t.apodo})` : '') }));

  const handleClientSelect = (v: string) => {
    const found = terceros.find(t => t.id === v);
    if (found) {
      set('clientId', found.id);
      set('clientName', found.name);
    } else if (v) {
      set('clientId', '');
      set('clientName', v);
    }
  };

  const handleCreateProjectClient = async () => {
    if (!newProjectClientName.trim()) return;
    const newId = await addTercero({ name: newProjectClientName.trim(), tipo: 'cliente' });
    set('clientId', newId);
    set('clientName', newProjectClientName.trim());
    setNewProjectClientName('');
    setShowNewProjectClient(false);
  };

  const handleSubmit = async () => {
    const data: Record<string, any> = { ...fields };
    data.cantidad = Number(data.cantidad) || 0;
    if (data.tipoProyectos === '__custom__') data.tipoProyectos = '';
    if (data.unidades === '__custom__') data.unidades = '';
    data.soloEgresos = data.soloEgresos === 'true';
    data.soloIngresos = data.soloIngresos === 'true';
    await onFormSubmit(data);
  };

  return (
    <div className="space-y-5">
      <FormInput label="Sigla" value={fields.name} onChange={v => set('name', v)} />
      <FormInput label="Nombre completo" value={fields.descripcion} onChange={v => set('descripcion', v)} />
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de proyecto</label>
        {fields.tipoProyectos === '__custom__' ? (
          <div className="flex gap-2">
            <input type="text" value={customTipo} onChange={e => { setCustomTipo(e.target.value); set('tipoProyectos', e.target.value); }}
              placeholder="Nuevo tipo..." className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none" autoFocus />
            <button onClick={() => { set('tipoProyectos', ''); setCustomTipo(''); }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Volver</button>
          </div>
        ) : (
          <ColorSelect value={fields.tipoProyectos} onChange={v => set('tipoProyectos', v)}
            items={(settingsData?.tipoProyectos || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
            placeholder="Seleccionar..." allowCustom />
        )}
      </div>
      <FormInput label="Cantidad" value={fields.cantidad} onChange={v => set('cantidad', v)} type="number" />
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidades</label>
        {fields.unidades === '__custom__' ? (
          <div className="flex gap-2">
            <input type="text" value={customUnidad} onChange={e => { setCustomUnidad(e.target.value); set('unidades', e.target.value); }}
              placeholder="Nueva unidad..." className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none" autoFocus />
            <button onClick={() => { set('unidades', ''); setCustomUnidad(''); }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Volver</button>
          </div>
        ) : (
          <ColorSelect value={fields.unidades} onChange={v => set('unidades', v)}
            items={(settingsData?.unidades || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
            placeholder="Seleccionar..." allowCustom />
        )}
      </div>
      <SearchableSelect label="Cliente" value={fields.clientId || fields.clientName} onChange={handleClientSelect}
        options={clientOptions.map(c => ({ value: c.value, label: c.label }))}
        placeholder="Buscar cliente..." />
      {!showNewProjectClient && (
        <button onClick={() => setShowNewProjectClient(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
          <Plus size={12} /> Nuevo cliente rápido
        </button>
      )}
      {showNewProjectClient && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200 -mt-3">
          <input type="text" value={newProjectClientName} onChange={e => setNewProjectClientName(e.target.value)}
            placeholder="Nombre del cliente" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
          <div className="flex gap-2">
            <button onClick={handleCreateProjectClient} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
            <button onClick={() => setShowNewProjectClient(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
          </div>
        </div>
      )}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
        <ColorSelect
          value={fields.estado}
          onChange={v => set('estado', v)}
          items={(settingsData?.stateProject || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
          placeholder="Seleccionar..."
        />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer py-1">
        <input type="checkbox" checked={fields.soloEgresos === 'true'} onChange={e => set('soloEgresos', e.target.checked ? 'true' : 'false')}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
        <span className="text-xs font-medium text-slate-600 select-none">Solo egresos</span>
        <span className="text-[10px] text-slate-400 ml-auto">(no aparece en Ingresos)</span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer py-1">
        <input type="checkbox" checked={fields.soloIngresos === 'true'} onChange={e => set('soloIngresos', e.target.checked ? 'true' : 'false')}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
        <span className="text-xs font-medium text-slate-600 select-none">Solo ingresos</span>
        <span className="text-[10px] text-slate-400 ml-auto">(no aparece en Egresos)</span>
      </label>
      <div className="pt-2">
        <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
