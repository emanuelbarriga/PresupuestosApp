'use client'

import { useState, useEffect } from 'react';
import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EntityProps, DocumentoMedio, TipoDocumentoMedio } from '@/lib/types';
import { DocumentoSidepanel } from './DocumentoSidepanel';
import { linkDocumentoToEntities } from '@/lib/mediaLinking';

interface DocumentoEntityProps extends EntityProps {
  onDocumentoUpdated?: (docId: string, periodo: string, tipoDocumento: TipoDocumentoMedio) => void;
}

export function DocumentoEntity({
  mode,
  companyId,
  record,
  onClose,
  onBack,
  canGoBack,
  onDocumentoUpdated,
}: DocumentoEntityProps) {
  const doc = record as DocumentoMedio | undefined;

  const [terceros, setTerceros] = useState<{ value: string; label: string }[]>([]);
  const [proyectos, setProyectos] = useState<{ value: string; label: string }[]>([]);
  const [ejecuciones, setEjecuciones] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Load terceros
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      collection(db, 'terceros'),
      (snap) => {
        setTerceros(
          snap.docs
            .filter((d) => d.data().archivado !== true)
            .map((d) => ({
              value: d.id,
              label: (d.data().name as string) || '',
            }))
            .filter((t) => t.label),
        );
      },
    );
    return () => unsub();
  }, [companyId]);

  // Load proyectos
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      collection(db, `companies/${companyId}/projects`),
      (snap) => {
        setProyectos(
          snap.docs.map((d) => ({
            value: d.id,
            label: (d.data().name as string) || '',
          })),
        );
      },
    );
    return () => unsub();
  }, [companyId]);

  // Load ejecuciones
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      collection(db, `companies/${companyId}/ejecuciones`),
      (snap) => {
        setEjecuciones(
          snap.docs.map((d) => ({
            value: d.id,
            label: `${d.data().descripcion || ''} (${d.data().fechaEjecutado || ''})`.trim(),
          })),
        );
      },
    );
    return () => unsub();
  }, [companyId]);

  const handleSave = async (data: {
    tipoDocumento: any;
    periodo: string;
    terceroId: string;
    projectId?: string;
    ejecucionIds: string[];
    metadata?: any;
  }) => {
    if (!doc || !companyId) return;
    setSaving(true);
    try {
      await linkDocumentoToEntities(companyId, doc.id, {
        tipoDocumento: data.tipoDocumento,
        periodo: data.periodo,
        terceroId: data.terceroId,
        projectId: data.projectId,
        ejecucionIds: data.ejecucionIds,
        metadata: data.metadata,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!doc) {
    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0 items-center justify-center">
        <p className="text-sm text-slate-500">Documento no encontrado</p>
      </div>
    );
  }

  return (
    <DocumentoSidepanel
      companyId={companyId}
      documento={doc}
      terceroOptions={terceros}
      proyectoOptions={proyectos}
      ejecucionOptions={ejecuciones}
      onSave={handleSave}
      onClose={onClose}
      onBack={onBack}
      canGoBack={canGoBack}
      saving={saving}
      onDocumentoUpdated={onDocumentoUpdated}
    />
  );
}
