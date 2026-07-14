'use client';

import { useState } from 'react';
import type { EntityProps } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { CompaniaView } from './CompaniaView';
import { CompaniaCreateForm } from './CompaniaCreateForm';

export function CompaniaEntity({
  mode,
  record,
  onSubmit,
  onNavigate,
  onClose,
  onBack,
  canGoBack,
}: EntityProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const title = mode === 'view' ? 'Empresa' : 'Crear empresa';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 select-text">
        {mode === 'view' && record ? (
          <CompaniaView
            name={(record as any).name}
            createdAt={(record as any).createdAt}
          />
        ) : mode === 'create' ? (
          <CompaniaCreateForm
            user={user}
            saving={saving}
            setSaving={setSaving}
            onSubmit={onSubmit}
            onBack={onBack}
          />
        ) : null}
      </div>
    </div>
  );
}
