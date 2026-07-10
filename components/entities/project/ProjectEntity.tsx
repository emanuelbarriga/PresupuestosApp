'use client';

import { useState, useEffect } from 'react';
import type { EntityProps, Project, Tercero, SettingsCategorias } from '@/lib/types';
import { subscribeCompanySettings, subscribeTerceros, subscribeProjects } from '@/lib/firestore';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { ProjectView } from './ProjectView';
import { ProjectForm } from './ProjectForm';

export function ProjectEntity({ mode, companyId, record, defaults, year, filterTipo, filterMode, onSubmit, onNavigate, onClose, onBack, canGoBack }: EntityProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [settingsData, setSettingsData] = useState<SettingsCategorias | null>(null);

  // Reference data subscriptions — always active (needed for view inferred check + form)
  useEffect(() => {
    const unsubs = [
      subscribeProjects(companyId, setProjects, () => {}),
      subscribeCompanySettings(companyId, setSettingsData),
      subscribeTerceros(setTerceros),
    ];
    return () => unsubs.forEach(u => u());
  }, [companyId]);

  const handleFormSubmit = async (data: Record<string, any>) => {
    await onSubmit({
      mode: mode === 'edit' ? 'edit' : 'create',
      entity: 'project',
      record: mode === 'edit' ? record : undefined,
      data,
    });
  };

  const title = mode === 'view' ? 'Proyecto' : mode === 'edit' ? 'Editar Proyecto' : 'Nuevo Proyecto';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {mode === 'view' && record ? (
          <ProjectView
            project={record as Project}
            projects={projects}
            companyId={companyId}
            settingsData={settingsData}
            year={year}
            filterTipo={filterTipo}
            filterMode={filterMode}
            onNavigate={onNavigate}
            onSubmit={onSubmit}
          />
        ) : (
          <ProjectForm
            mode={mode === 'edit' ? 'edit' : 'add'}
            record={mode === 'edit' ? record : undefined}
            defaults={defaults}
            companyId={companyId}
            terceros={terceros}
            settingsData={settingsData}
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
