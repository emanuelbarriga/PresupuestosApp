'use client';

import type { Tercero, NavScreen } from '@/lib/types';
import { DF } from '@/components/shared/DF';
import { Pencil } from 'lucide-react';

interface TerceroViewProps {
  tercero: Tercero;
  onNavigate: (screen: NavScreen) => void;
}

const tipoColors: Record<string, string> = {
  cliente: 'bg-blue-100 text-blue-700 border-blue-200',
  proveedor: 'bg-amber-100 text-amber-700 border-amber-200',
  ambos: 'bg-purple-100 text-purple-700 border-purple-200',
};

const tipoLabels: Record<string, string> = {
  cliente: 'Cliente',
  proveedor: 'Proveedor',
  ambos: 'Ambos',
};

export function TerceroView({ tercero, onNavigate }: TerceroViewProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Tercero</p>
        <button onClick={() => onNavigate({ type: 'entity', entity: 'tercero', mode: 'edit', record: tercero })}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
          <Pencil size={12} /> Editar
        </button>
      </div>
      <DF label="Nombre" v={tercero.name} />
      {tercero.apodo && <DF label="Apodo" v={tercero.apodo} />}
      {tercero.naturaleza && <DF label="Naturaleza" v={tercero.naturaleza} />}
      {tercero.documento && tercero.numeroDocumento && (
        <DF label="Documento" v={`${tercero.documento} ${tercero.numeroDocumento}`} />
      )}
      {tercero.lugar && <DF label="Lugar" v={tercero.lugar} />}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</p>
        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold border ${tipoColors[tercero.tipo] || 'bg-slate-100 text-slate-600'}`}>
          {tipoLabels[tercero.tipo] || tercero.tipo}
        </span>
      </div>
    </>
  );
}
