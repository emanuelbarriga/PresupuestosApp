'use client';

import type { EntityProps } from '@/lib/types';
import { SettingsEditor } from '@/components/shared/SettingsEditor';

export function SettingsEntity({
  companyId,
  record,
  onClose,
}: EntityProps) {
  const category = record?.category ?? '';
  const settingsTitle = record?.title ?? 'Configuración';
  const items = record?.items ?? [];

  return (
    <SettingsEditor
      category={category}
      title={settingsTitle}
      items={items}
      companyId={companyId}
      onClose={onClose}
    />
  );
}
