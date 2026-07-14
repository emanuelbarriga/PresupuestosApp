'use client';

import React, { useState } from 'react';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { batchUpdateTerceros } from '@/lib/firestore';
import toast from 'react-hot-toast';

interface BulkEditTerceroPanelProps {
  selectedIds: string[];
  companyId: string;
  onClose: (failedIds?: string[]) => void;
}

type BulkEditFields = {
  name?: string;
  tipo?: string;
  naturaleza?: string;
  lugar?: string;
  archivado?: boolean;
};

export function BulkEditTerceroPanel({
  selectedIds,
  companyId,
  onClose,
}: BulkEditTerceroPanelProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [tipo, setTipo] = useState('');
  const [naturaleza, setNaturaleza] = useState('');
  const [lugar, setLugar] = useState('');
  const [archivado, setArchivado] = useState<boolean | null>(null);

  const hasChanges = name !== '' || tipo !== '' || naturaleza !== '' || lugar !== '' || archivado !== null;

  const buildPayload = (): Record<string, any> => {
    const data: Record<string, any> = {};
    if (name !== '') data.name = name;
    if (tipo !== '') data.tipo = tipo;
    if (naturaleza !== '') data.naturaleza = naturaleza;
    if (lugar !== '') data.lugar = lugar;
    if (archivado !== null) data.archivado = archivado;
    return data;
  };

  const handleSave = async () => {
    if (!hasChanges) {
      toast('No hay cambios para guardar', { icon: 'ℹ️' });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const data = buildPayload();
      const result = await batchUpdateTerceros(selectedIds, data, companyId);

      if (result.failedIds.length === 0) {
        toast.success(
          `${result.successCount} tercero${result.successCount !== 1 ? 's' : ''} actualizado${result.successCount !== 1 ? 's' : ''} correctamente`,
        );
        onClose();
      } else {
        toast.error(
          `${result.successCount} actualizado${result.successCount !== 1 ? 's' : ''}, ${result.failedIds.length} falló${result.failedIds.length !== 1 ? 'ron' : ''}`,
        );
        onClose(result.failedIds);
      }
    } catch {
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader
        title="Editar en lote"
        canGoBack={false}
        onBack={() => {}}
        onClose={() => onClose()}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <p className="text-xs text-slate-500">
          {selectedIds.length} tercero{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}.
          Solo se actualizarán los campos que modifiques.
        </p>

        {/* Nombre */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Sin cambios"
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
          />
          <p className="text-[10px] text-slate-400 mt-1">Se actualizará en todas las ejecuciones y presupuestos vinculados.</p>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Tipo
          </label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
          >
            <option value="">Sin cambios</option>
            <option value="cliente">Cliente</option>
            <option value="proveedor">Proveedor</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>

        {/* Naturaleza */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Naturaleza
          </label>
          <select
            value={naturaleza}
            onChange={e => setNaturaleza(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
          >
            <option value="">Sin cambios</option>
            <option value="Persona Natural">Persona Natural</option>
            <option value="Persona Jurídica">Persona Jurídica</option>
          </select>
        </div>

        {/* Lugar */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Lugar
          </label>
          <input
            type="text"
            value={lugar}
            onChange={e => setLugar(e.target.value)}
            placeholder="Sin cambios"
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Archivado */}
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Archivado
          </label>
          <select
            value={archivado === null ? '' : archivado ? 'true' : 'false'}
            onChange={e => {
              const v = e.target.value;
              setArchivado(v === '' ? null : v === 'true');
            }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
          >
            <option value="">Sin cambios</option>
            <option value="true">Archivado</option>
            <option value="false">No archivado</option>
          </select>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
