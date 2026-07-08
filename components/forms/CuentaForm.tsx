'use client';

import React, { useState } from 'react';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { PanelHeader } from '@/components/shared/PanelHeader';

export interface CuentaFormData {
  nombre: string;
  banco: string;
  tipo: string;
  numero: string;
  moneda: string;
  saldoInicial: string;
}

interface CuentaFormProps {
  form: { mode: 'add' | 'edit'; type: 'cuenta'; record?: any; defaults?: Record<string, string> };
  title: string;
  onSubmit: (form: any, data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
}

export function CuentaForm({
  form,
  title,
  onSubmit,
  onBack,
  onClose,
  saving,
}: CuentaFormProps) {
  const [fields, setFields] = useState<CuentaFormData>(() => {
    if (form.mode === 'edit' && form.record) {
      const r = form.record as any;
      return {
        nombre: String(r.nombre ?? ''),
        banco: String(r.banco ?? ''),
        tipo: String(r.tipo ?? ''),
        numero: String(r.numero ?? ''),
        moneda: String(r.moneda ?? ''),
        saldoInicial: String(r.saldoInicial ?? ''),
      };
    }
    const defs = form.defaults || {};
    return {
      nombre: defs.nombre ?? '',
      banco: defs.banco ?? '',
      tipo: defs.tipo ?? '',
      numero: defs.numero ?? '',
      moneda: defs.moneda ?? 'COP',
      saldoInicial: defs.saldoInicial ?? '',
    };
  });

  const set = (k: keyof CuentaFormData, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    const data: Record<string, any> = { ...fields };
    data.saldoInicial = Number(data.saldoInicial) || 0;
    if (form.mode === 'add') data.saldoActual = data.saldoInicial;
    await onSubmit(form, data);
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <FormInput label="Nombre" value={fields.nombre} onChange={v => set('nombre', v)} />
        <FormInput label="Banco" value={fields.banco} onChange={v => set('banco', v)} />
        <FormSelect label="Tipo" value={fields.tipo} onChange={v => set('tipo', v)}
          options={[
            { value: 'Ahorros', label: 'Ahorros' },
            { value: 'Corriente', label: 'Corriente' },
            { value: 'Tarjeta de Crédito', label: 'Tarjeta de Crédito' },
            { value: 'Caja Menor / Efectivo', label: 'Caja Menor / Efectivo' },
          ]} />
        <FormInput label="Número de cuenta" value={fields.numero} onChange={v => set('numero', v)} />
        <FormSelect label="Moneda" value={fields.moneda} onChange={v => set('moneda', v)}
          options={[
            { value: 'COP', label: 'COP' },
            { value: 'USD', label: 'USD' },
            { value: 'EUR', label: 'EUR' },
          ]} />
        <FormInput label="Saldo inicial" value={fields.saldoInicial} onChange={v => set('saldoInicial', v)} type="number" />
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
