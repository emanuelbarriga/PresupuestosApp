'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { batchUpdatePresupuestos, getTerceros } from '@/lib/firestore';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import type { Tercero } from '@/lib/types';
import toast from 'react-hot-toast';

interface BulkEditPresupuestosPanelProps {
  selectedIds: string[];
  companyId: string;
  onClose: (failedIds?: string[]) => void;
}

export function BulkEditPresupuestosPanel({
  selectedIds,
  companyId,
  onClose,
}: BulkEditPresupuestosPanelProps) {
  const [saving, setSaving] = useState(false);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [entityId, setEntityId] = useState('');
  const [entityName, setEntityName] = useState('');

  useEffect(() => {
    getTerceros().then(setTerceros).catch(() => {});
  }, []);

  const terceroOptions = useMemo(() =>
    terceros.map(t => ({ value: t.id, label: t.name })),
    [terceros],
  );

  const hasChanges = entityId !== '';

  const buildPayload = (): Record<string, any> => {
    const data: Record<string, any> = {};
    if (entityId !== '') {
      data.entityId = entityId;
      data.entityName = entityName;
    }
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
      const result = await batchUpdatePresupuestos(companyId, selectedIds, data);

      if (result.failedIds.length === 0) {
        toast.success(
          `${result.successCount} presupuesto${result.successCount !== 1 ? 's' : ''} actualizado${result.successCount !== 1 ? 's' : ''} correctamente`,
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
          {selectedIds.length} presupuesto{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}.
          Solo se actualizará el tercero si seleccionás uno.
        </p>

        <SearchableSelect
          label="Cliente / Proveedor"
          value={entityId}
          onChange={v => {
            const t = terceros.find(t => t.id === v);
            setEntityId(v);
            setEntityName(t?.name ?? '');
          }}
          options={terceroOptions}
          placeholder="Buscar tercero..."
        />

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
