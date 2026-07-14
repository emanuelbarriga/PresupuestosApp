'use client';

import { useState, useEffect } from 'react';
import type { EntityProps } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { ExtractoView } from './ExtractoView';
import { ExtractoAddView } from './ExtractoAddView';
import { ExtractoEditView } from './ExtractoEditView';

export function ExtractoEntity({
  mode,
  companyId,
  record,
  defaults,
  onSubmit,
  onNavigate,
  onClose,
  onBack,
  canGoBack,
}: EntityProps) {
  const title =
    mode === 'view' ? 'Extracto'
    : mode === 'edit' ? 'Editar Extracto'
    : 'Nuevo Extracto';

  const handleSave = async (data: Record<string, any>) => {
    await onSubmit({
      mode: mode === 'edit' ? 'edit' : 'create',
      entity: 'extracto',
      record: mode === 'edit' ? record : undefined,
      data,
    });
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
        {mode === 'view' && record ? (
          <ExtractoView
            extracto={record as any}
            onNavigate={onNavigate}
            onEdit={() =>
              onNavigate({
                type: 'entity',
                entity: 'extracto',
                mode: 'edit',
                record,
              })
            }
          />
        ) : mode === 'create' ? (
          <ExtractoAddView
            companyId={companyId}
            accountId={defaults?.accountId ?? ''}
            onSave={handleSave}
            onBack={onBack}
            onClose={onClose}
          />
        ) : (
          <ExtractoEditView
            companyId={companyId}
            record={record as any}
            onSave={handleSave}
            onBack={onBack}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
