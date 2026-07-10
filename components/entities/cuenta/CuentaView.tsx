'use client';

import type { CuentaBancaria, NavScreen } from '@/lib/types';
import { DF } from '@/components/shared/DF';
import { Pencil } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

const tipoColors: Record<string, string> = {
  Ahorros: 'bg-emerald-100 text-emerald-700',
  Corriente: 'bg-blue-100 text-blue-700',
  'Tarjeta de Crédito': 'bg-rose-100 text-rose-700',
  'Caja Menor / Efectivo': 'bg-amber-100 text-amber-700',
};

interface CuentaViewProps {
  cuenta: CuentaBancaria;
  onNavigate: (screen: NavScreen) => void;
}

export function CuentaView({ cuenta, onNavigate }: CuentaViewProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle de la Cuenta</p>
        <button onClick={() => onNavigate({ type: 'entity', entity: 'cuenta', mode: 'edit', record: cuenta })}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
          <Pencil size={12} /> Editar
        </button>
      </div>
      <DF label="Nombre" v={cuenta.nombre} />
      <DF label="Banco" v={cuenta.banco} />
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</p>
        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold border ${tipoColors[cuenta.tipo] || 'bg-slate-100 text-slate-600'}`}>
          {cuenta.tipo}
        </span>
      </div>
      <DF label="Número" v={cuenta.numero} />
      <DF label="Moneda" v={cuenta.moneda} />
      <DF label="Saldo inicial" v={formatCurrency(cuenta.saldoInicial)} />
      <DF label="Saldo actual" v={formatCurrency(cuenta.saldoActual)} />
    </>
  );
}
