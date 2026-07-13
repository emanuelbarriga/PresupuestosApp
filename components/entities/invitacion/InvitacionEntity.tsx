'use client';

import { useState, useCallback } from 'react';
import type { EntityProps } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useCompanyStore } from '@/stores/companyStore';
import { createInvitation, updateInvitation } from '@/lib/firestore';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { InvitacionView } from './InvitacionView';
import { InvitacionCreateForm } from './InvitacionCreateForm';
import { InvitacionEditForm } from './InvitacionEditForm';

export function InvitacionEntity({
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
  const { user: currentUser } = useAuth();
  const companies = useCompanyStore(s => s.companies);
  const selectedCompany = useCompanyStore(s => s.selectedCompany);
  const [saving, setSaving] = useState(false);

  const triggerPop = useCallback(async () => {
    await onSubmit({ mode: 'archive', entity: 'invitacion', data: {} });
  }, [onSubmit]);

  const title =
    mode === 'view' ? 'Invitación' :
    mode === 'edit' ? 'Editar invitación' :
    'Invitar colaborador';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {mode === 'view' && record ? (
          <InvitacionView
            invitacion={record as any}
            onNavigate={() => onNavigate({
              type: 'entity',
              entity: 'invitacion',
              mode: 'edit',
              record,
            })}
          />
        ) : mode === 'edit' && record ? (
          <InvitacionEditForm
            record={record as any}
            currentUser={currentUser}
            companies={companies}
            selectedCompany={selectedCompany}
            saving={saving}
            setSaving={setSaving}
            onBack={onBack}
            onUpdateInvitation={async (id, data) => {
              await updateInvitation(id, data);
            }}
            onSuccess={triggerPop}
          />
        ) : (
          <InvitacionCreateForm
            currentUser={currentUser}
            companies={companies}
            selectedCompany={selectedCompany}
            saving={saving}
            setSaving={setSaving}
            onCreateInvitation={async (data) => {
              await createInvitation(data);
            }}
            onSuccess={triggerPop}
            onBack={onBack}
          />
        )}
      </div>
    </div>
  );
}
