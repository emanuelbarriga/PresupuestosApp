'use client';

import type { EntityProps } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { CuentaView } from './CuentaView';
import { CuentaForm } from './CuentaForm';

export function CuentaEntity({ mode, companyId, record, defaults, onSubmit, onNavigate, onClose, onBack, canGoBack }: EntityProps) {
  const handleFormSubmit = async (data: Record<string, any>) => {
    await onSubmit({
      mode: mode === 'edit' ? 'edit' : 'create',
      entity: 'cuenta',
      record: mode === 'edit' ? record : undefined,
      data,
    });
  };

  const title = mode === 'view' ? 'Cuenta Bancaria' : mode === 'edit' ? 'Editar Cuenta' : 'Nueva Cuenta';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
        {mode === 'view' && record ? (
          <CuentaView
            cuenta={record as any}
            onNavigate={onNavigate}
          />
        ) : (
          <CuentaForm
            mode={mode === 'edit' ? 'edit' : 'add'}
            record={mode === 'edit' ? record : undefined}
            defaults={defaults}
            onFormSubmit={handleFormSubmit}
            saving={false}
          />
        )}
      </div>
    </div>
  );
}
