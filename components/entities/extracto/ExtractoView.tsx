'use client';

import type { ExtractoBancario, NavScreen } from '@/lib/types';
import { DF } from '@/components/shared/DF';
import { Pencil, ExternalLink } from 'lucide-react';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

const estadoColors: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  'En revisión': 'bg-blue-100 text-blue-700 border-blue-200',
  Conciliado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Completado: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Error de parseo': 'bg-rose-100 text-rose-700 border-rose-200',
};

interface ExtractoViewProps {
  extracto: ExtractoBancario;
  onNavigate: (screen: NavScreen) => void;
  onEdit: () => void;
}

export function ExtractoView({ extracto, onEdit }: ExtractoViewProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Extracto</p>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Pencil size={12} /> Editar
        </button>
      </div>

      <DF label="Mes" v={extracto.mes} />
      <DF label="Año" v={String(extracto.anio)} />
      <DF label="Saldo inicial" v={formatCurrency(extracto.saldoInicial)} />
      <DF label="Saldo final" v={formatCurrency(extracto.saldoFinal)} />

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado</p>
        <span
          className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold border ${
            estadoColors[extracto.estado] || 'bg-slate-100 text-slate-600'
          }`}
        >
          {extracto.estado}
        </span>
      </div>

      {extracto.archivo?.url && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Archivo</p>
          <a
            href={extracto.archivo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            <ExternalLink size={14} />
            {extracto.archivo.name || 'Ver PDF'}
          </a>
        </div>
      )}

      {extracto.totalMovimientosParseados != null && (
        <DF label="Movimientos parseados" v={String(extracto.totalMovimientosParseados)} />
      )}
    </>
  );
}
