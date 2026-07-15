'use client';

import type { EntityProps } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { TerceroView } from './TerceroView';
import { TerceroForm } from './TerceroForm';

export function TerceroEntity({ mode, companyId, record, defaults, onSubmit, onNavigate, onClose, onBack, canGoBack }: EntityProps) {
  const handleFormSubmit = async (data: Record<string, any>) => {
    await onSubmit({
      mode: mode === 'edit' ? 'edit' : 'create',
      entity: 'tercero',
      record: mode === 'edit' ? record : undefined,
      data,
    });
  };

  const title = mode === 'view' ? 'Tercero' : mode === 'edit' ? 'Editar Tercero' : 'Nuevo Tercero';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
        {mode === 'view' && record ? (
          <TerceroView
            companyId={companyId}
            tercero={record as any}
            onNavigate={onNavigate}
          />
        ) : (
          <TerceroForm
            mode={mode === 'edit' ? 'edit' : 'add'}
            record={mode === 'edit' ? record : undefined}
            defaults={defaults}
            onFormSubmit={handleFormSubmit}
            onBack={onBack}
            onClose={onClose}
            saving={false}
          />
        )}
      </div>
    </div>
  );
}
