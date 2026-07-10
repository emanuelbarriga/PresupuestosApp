'use client';

import React, { useState } from 'react';
import type { Tercero } from '@/lib/types';
import { FormInput } from '@/components/forms/FormInput';

export interface TerceroFormData {
  name: string;
  apodo: string;
  naturaleza: string;
  documento: string;
  numeroDocumento: string;
  lugar: string;
  tipo: string;
}

interface TerceroFormProps {
  mode: 'add' | 'edit';
  record?: Tercero;
  defaults?: Record<string, string>;
  onFormSubmit: (data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
}

export function TerceroForm({
  mode,
  record,
  defaults,
  onFormSubmit,
  saving,
}: TerceroFormProps) {
  const [fields, setFields] = useState<TerceroFormData>(() => {
    if (mode === 'edit' && record) {
      const r = record as any;
      return {
        name: String(r.name ?? ''),
        apodo: String(r.apodo ?? ''),
        naturaleza: String(r.naturaleza ?? ''),
        documento: String(r.documento ?? ''),
        numeroDocumento: String(r.numeroDocumento ?? ''),
        lugar: String(r.lugar ?? ''),
        tipo: String(r.tipo ?? ''),
      };
    }
    const defs = defaults || {};
    return {
      name: defs.name ?? '',
      apodo: defs.apodo ?? '',
      naturaleza: defs.naturaleza ?? '',
      documento: defs.documento ?? '',
      numeroDocumento: defs.numeroDocumento ?? '',
      lugar: defs.lugar ?? '',
      tipo: defs.tipo ?? 'cliente',
    };
  });

  const set = (k: keyof TerceroFormData, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    await onFormSubmit({ ...fields });
  };

  return (
    <div className="space-y-5">
      <FormInput label="Nombre *" value={fields.name} onChange={v => set('name', v)} />
      <FormInput label="Apodo" value={fields.apodo} onChange={v => set('apodo', v)} />
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Naturaleza</label>
        <select value={fields.naturaleza} onChange={e => set('naturaleza', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
          <option value="">Seleccionar...</option>
          <option value="Persona Natural">Persona Natural</option>
          <option value="Persona Jurídica">Persona Jurídica</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Documento</label>
        <select value={fields.documento} onChange={e => set('documento', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
          <option value="">Seleccionar...</option>
          <option value="CC">CC</option>
          <option value="NIT">NIT</option>
          <option value="RUC">RUC</option>
          <option value="CI">CI</option>
          <option value="ID">ID</option>
          <option value="RFC">RFC</option>
        </select>
      </div>
      <FormInput label="Número de documento" value={fields.numeroDocumento} onChange={v => set('numeroDocumento', v)} />
      <FormInput label="Lugar" value={fields.lugar} onChange={v => set('lugar', v)} />
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
        <select value={fields.tipo} onChange={e => set('tipo', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
          <option value="cliente">Cliente</option>
          <option value="proveedor">Proveedor</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>
      <div className="pt-2">
        <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
