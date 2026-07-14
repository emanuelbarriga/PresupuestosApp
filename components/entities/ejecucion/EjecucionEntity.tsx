'use client';

import { useState, useEffect, useMemo } from 'react';
import type { EntityProps, Project, Client, Provider, SettingsCategorias, Budget, CuentaBancaria } from '@/lib/types';
import {
  subscribeProjects,
  subscribeClients,
  subscribeProviders,
  subscribeCompanySettings,
  subscribeBudgets,
  subscribeCuentasBancarias,
} from '@/lib/firestore';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { EjecucionView } from './EjecucionView';
import { EjecucionForm } from './EjecucionForm';

export function EjecucionEntity({ mode, companyId, record, defaults, onSubmit, onNavigate, onClose, onBack, canGoBack }: EntityProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settingsData, setSettingsData] = useState<SettingsCategorias | null>(null);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);

  // Reference data subscriptions — always active (needed for create/edit forms)
  useEffect(() => {
    const unsubs = [
      subscribeProjects(companyId, setProjects, () => {}),
      subscribeClients(setClients),
      subscribeProviders(setProviders),
      subscribeCompanySettings(companyId, setSettingsData),
      subscribeBudgets(companyId, setAllBudgets),
      subscribeCuentasBancarias(companyId, setCuentas),
    ];
    return () => unsubs.forEach(u => u());
  }, [companyId]);

  const clientsAndProviders = useMemo(() => [
    ...clients.map(c => ({ value: c.id, label: c.name, type: 'client' as const })),
    ...providers.filter(p => !clients.some(c => c.id === p.id)).map(p => ({ value: p.id, label: p.name, type: 'provider' as const })),
    { value: '', label: 'Interno', type: 'interno' as const },
  ], [clients, providers]);

  const handleFormSubmit = async (data: Record<string, any>) => {
    await onSubmit({
      mode: mode === 'edit' ? 'edit' : 'create',
      entity: 'ejecucion',
      record: mode === 'edit' ? record : undefined,
      data,
    });
  };

  const title = mode === 'view' ? 'Ejecución' : mode === 'edit' ? 'Editar Ejecución' : 'Nueva Ejecución';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
        {mode === 'view' && record ? (
          <EjecucionView
            ejecucion={record as any}
            companyId={companyId}
            cuentas={cuentas}
            onNavigate={onNavigate}
            onSubmit={onSubmit}
          />
        ) : (
          <EjecucionForm
            mode={mode === 'edit' ? 'edit' : 'add'}
            record={mode === 'edit' ? record : undefined}
            defaults={defaults}
            companyId={companyId}
            projects={projects}
            clients={clients}
            providers={providers}
            clientsAndProviders={clientsAndProviders}
            allBudgets={allBudgets}
            cuentas={cuentas}
            settingsData={settingsData}
            onFormSubmit={handleFormSubmit}
            saving={false}
          />
        )}
      </div>
    </div>
  );
}
