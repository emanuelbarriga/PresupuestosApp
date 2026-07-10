'use client';

import React, { useState } from 'react';
import type { CuentaBancaria } from '@/lib/types';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';

export interface CuentaFormData {
  nombre: string;
  banco: string;
  tipo: string;
  numero: string;
  moneda: string;
  saldoInicial: string;
}

interface CuentaFormProps {
  mode: 'add' | 'edit';
  record?: CuentaBancaria;
  defaults?: Record<string, string>;
  onFormSubmit: (data: Record<string, any>) => Promise<void>;
  saving: boolean;
}

export function CuentaForm({
  mode,
  record,
  defaults,
  onFormSubmit,
  saving,
}: CuentaFormProps) {
  const [fields, setFields] = useState<CuentaFormData>(() => {
    if (mode === 'edit' && record) {
      const r = record as any;
      return {
        nombre: String(r.nombre ?? ''),
        banco: String(r.banco ?? ''),
        tipo: String(r.tipo ?? ''),
        numero: String(r.numero ?? ''),
        moneda: String(r.moneda ?? ''),
        saldoInicial: String(r.saldoInicial ?? ''),
      };
    }
    const defs = defaults || {};
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
    if (mode === 'add') data.saldoActual = data.saldoInicial;
    await onFormSubmit(data);
  };

  return (
    <div className="space-y-5">
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
      <div className="pt-2">
        <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
