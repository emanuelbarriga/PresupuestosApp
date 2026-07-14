'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { batchUpdateEjecuciones, getTerceros, subscribeProjects } from '@/lib/firestore';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { TipoSwitch } from '@/components/forms/TipoSwitch';
import type { Tercero, Project } from '@/lib/types';
import { formatThousands, unformatThousands } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BulkEditEjecucionesPanelProps {
  selectedIds: string[];
  companyId: string;
  onClose: (failedIds?: string[]) => void;
}

export function BulkEditEjecucionesPanel({
  selectedIds,
  companyId,
  onClose,
}: BulkEditEjecucionesPanelProps) {
  const [saving, setSaving] = useState(false);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [entityId, setEntityId] = useState('');
  const [entityName, setEntityName] = useState('');

  const [descripcion, setDescripcion] = useState('');
  const [montoEjecutado, setMontoEjecutado] = useState('');
  const [montoEditing, setMontoEditing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [tipo, setTipo] = useState('');
  const [archivado, setArchivado] = useState<boolean | null>(null);

  useEffect(() => {
    getTerceros().then(setTerceros).catch(() => {});
  }, []);

  useEffect(() => {
    return subscribeProjects(companyId, setProjects);
  }, [companyId]);

  const terceroOptions = useMemo(() =>
    terceros.map(t => ({ value: t.id, label: t.name })),
    [terceros],
  );

  const projectOptions = useMemo(() =>
    projects.map(p => ({ value: p.id, label: p.name })),
    [projects],
  );

  const hasChanges =
    entityId !== '' ||
    descripcion !== '' ||
    montoEjecutado !== '' ||
    projectId !== '' ||
    tipo !== '' ||
    archivado !== null;

  const buildPayload = (): Record<string, any> => {
    const data: Record<string, any> = {};
    if (entityId !== '') {
      data.entityId = entityId;
      data.entityName = entityName;
    }
    if (descripcion !== '') {
      data.descripcion = descripcion;
    }
    if (montoEjecutado !== '') {
      data.montoEjecutado = Number(montoEjecutado);
    }
    if (projectId !== '') {
      data.projectId = projectId;
      data.projectName = projectName;
    }
    if (tipo !== '') {
      data.tipo = tipo;
    }
    if (archivado !== null) {
      data.archivado = archivado;
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
      const result = await batchUpdateEjecuciones(companyId, selectedIds, data);

      if (result.failedIds.length === 0) {
        toast.success(
          `${result.successCount} ejecución${result.successCount !== 1 ? 'es' : ''} actualizada${result.successCount !== 1 ? 's' : ''} correctamente`,
        );
        onClose();
      } else {
        toast.error(
          `${result.successCount} actualizada${result.successCount !== 1 ? 's' : ''}, ${result.failedIds.length} falló${result.failedIds.length !== 1 ? 'ron' : ''}`,
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
      <div className="flex-1 overflow-y-auto p-6 space-y-5 select-text">
        <p className="text-xs text-slate-500">
          {selectedIds.length} ejecución{selectedIds.length !== 1 ? 'es' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}.
          Solo se actualizarán los campos que modifiques.
        </p>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Descripción</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            placeholder="Sin cambios" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Monto Ejecutado</label>
          <input type="text" inputMode="numeric"
            value={montoEditing ? unformatThousands(montoEjecutado) : formatThousands(montoEjecutado)}
            onFocus={() => setMontoEditing(true)}
            onBlur={() => setMontoEditing(false)}
            onChange={e => setMontoEjecutado(unformatThousands(e.target.value))}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-right"
            placeholder="Sin cambios" />
        </div>

        <SearchableSelect
          label="Cliente / Proveedor"
          value={entityId}
          onChange={v => {
            const t = terceros.find(t => t.id === v);
            setEntityId(v);
            setEntityName(t?.name ?? '');
          }}
          options={terceroOptions}
          placeholder="Sin cambios"
        />

        <SearchableSelect
          label="Proyecto"
          value={projectId}
          onChange={v => {
            const p = projects.find(pj => pj.id === v);
            setProjectId(v);
            setProjectName(p?.name ?? '');
          }}
          options={projectOptions}
          placeholder="Sin cambios"
        />

        <TipoSwitch value={tipo} onChange={setTipo} />

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Archivado</label>
          <button type="button" onClick={() => {
            setArchivado(prev => prev === null ? true : prev === true ? false : null);
          }}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-left focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all">
            {archivado === null ? 'Sin cambios' : archivado ? 'Sí' : 'No'}
          </button>
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
