'use client';

import { useState } from 'react';
import type { Tercero, NavScreen } from '@/lib/types';
import { DF } from '@/components/shared/DF';
import { Pencil, FileText } from 'lucide-react';
import { SoportesTab } from '@/components/entities/shared/SoportesTab';

interface TerceroViewProps {
  companyId: string;
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

type Tab = 'detalle' | 'soportes';

export function TerceroView({ companyId, tercero, onNavigate }: TerceroViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('detalle');

  return (
    <>
      <div className="border-b border-slate-200 flex gap-0 bg-white shrink-0 -mx-6 px-6">
        <button
          className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'detalle' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('detalle')}
        >
          Detalle
          {activeTab === 'detalle' && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
        <button
          className={`px-4 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'soportes' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('soportes')}
        >
          <FileText size={14} />
          Soportes
          {activeTab === 'soportes' && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'detalle' ? (
        <>
          <div className="flex items-center justify-between mb-2 mt-4">
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
      ) : (
        <div className="mt-4">
          <SoportesTab
            companyId={companyId}
            terceroId={tercero.id}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </>
  );
}
