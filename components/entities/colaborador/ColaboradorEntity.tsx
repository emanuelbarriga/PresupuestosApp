'use client';

import { useState } from 'react';
import type { EntityProps } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { useCompanyStore } from '@/stores/companyStore';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { ColaboradorView } from './ColaboradorView';
import { ColaboradorEditForm } from './ColaboradorEditForm';

export function ColaboradorEntity({
  mode,
  companyId,
  record,
  onSubmit,
  onNavigate,
  onClose,
  onBack,
  canGoBack,
}: EntityProps) {
  const { user: currentUser } = useAuth();
  const allCompanies = useCompanyStore(s => s.companies);
  const [saving, setSaving] = useState(false);

  const handleSave = async (
    memberships: any[],
    originalMemberships: any[],
  ) => {
    if (!record || !currentUser) return;
    setSaving(true);
    try {
      const { userId, email } = record as any;
      const token = await currentUser.getIdToken();
      const originalMap = new Map(originalMemberships.map((om: any) => [om.companyId, om]));

      for (const m of memberships) {
        const original = originalMap.get(m.companyId);

        if (m.isNew) {
          await fetch('/api/companies/manage-member', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'add', companyId: m.companyId, userId, email, role: m.role }),
          });
        } else if (original) {
          if (m.active !== !original.blocked) {
            await fetch('/api/companies/manage-member', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'block', companyId: m.companyId, userId, blocked: !m.active }),
            });
          }
          if (m.role !== original.role) {
            await fetch('/api/companies/manage-member', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'update-role', companyId: m.companyId, userId, role: m.role }),
            });
          }
        }
      }

      await onSubmit({ mode: 'edit', entity: 'colaborador', record, data: {} });
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'view' ? 'Colaborador' : 'Gestionar colaborador';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {mode === 'view' && record ? (
          <ColaboradorView
            email={(record as any).email}
            memberships={(record as any).memberships || []}
            onEdit={() => onNavigate({
              type: 'entity',
              entity: 'colaborador',
              mode: 'edit',
              record,
            })}
          />
        ) : mode === 'edit' && record ? (
          <ColaboradorEditForm
            record={record as any}
            allCompanies={allCompanies}
            saving={saving}
            onSave={handleSave}
            onBack={onBack}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}
