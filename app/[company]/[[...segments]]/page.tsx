'use client'

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ViewType, SidepanelData, Budget, Ejecucion, Project, Client, Provider, RecordDetail, ActiveForm, FormType } from '@/lib/types';
import { CompanyProvider } from '@/context/CompanyContext';
import {
  subscribeBudgets,
  subscribeEjecuciones,
  addBudget,
  addEjecucion,
  addClient,
  addProvider,
  addProject,
  updateBudget,
  updateEjecucion,
  updateClient,
  updateProvider,
  updateProject,
} from '@/lib/firestore';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Datos } from '@/components/Datos';
import { Construction } from '@/components/Construction';
import { Sidepanel } from '@/components/Sidepanel';

type Props = {
  params: Promise<{ company: string; segments?: string[] }>;
};

function viewFromSegments(segments?: string[]): { view: ViewType; tab?: string } {
  const main = segments?.[0]?.toLowerCase() || 'dashboard';
  const tab = segments?.[1];
  if (main === 'dashboard') return { view: 'Dashboard' };
  if (main === 'datos') return { view: 'Datos', tab };
  if (main === 'proyectos') return { view: 'Proyectos' };
  if (main === 'proveedores') return { view: 'Proveedores' };
  if (main === 'clientes') return { view: 'Clientes' };
  if (main === 'extractos') return { view: 'Extractos' };
  return { view: 'Dashboard' };
}

export default function CompanyPage({ params }: Props) {
  const { company: companyId, segments } = use(params);
  const router = useRouter();
  const { view: activeView, tab: activeTab } = viewFromSegments(segments);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidepanelData, setSidepanelData] = useState<SidepanelData | null>(null);
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeBudgets(companyId, setBudgets, (err) => console.error('Error loading budgets:', err)),
      subscribeEjecuciones(companyId, setEjecuciones, (err) => console.error('Error loading ejecuciones:', err)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  const closePanel = () => {
    setSidepanelData(null);
    setRecordDetail(null);
    setActiveForm(null);
    setSidebarCollapsed(false);
  };

  const navigateTo = (view: ViewType, tab?: string) => {
    closePanel();
    let path = `/${companyId}`;
    if (view === 'Dashboard') path += '/dashboard';
    else if (view === 'Datos') path += `/datos${tab ? `/${tab.toLowerCase()}` : ''}`;
    else path += `/${view.toLowerCase()}`;
    router.push(path);
  };

  const handleSidebarToggle = () => {
    const newCollapsedState = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsedState);
    if (!newCollapsedState) closePanel();
  };

  const handleCellClick = (data: SidepanelData) => {
    setRecordDetail(null);
    setActiveForm(null);
    setSidepanelData(data);
    setSidebarCollapsed(true);
  };

  const handleViewRecord = (detail: RecordDetail) => {
    setSidepanelData(null);
    setActiveForm(null);
    setRecordDetail(detail);
    setSidebarCollapsed(true);
  };

  const handleAddNew = (type: FormType) => {
    setSidepanelData(null);
    setRecordDetail(null);
    setActiveForm({ mode: 'add', type });
    setSidebarCollapsed(true);
  };

  const handleEditRecord = (form: ActiveForm) => {
    setSidepanelData(null);
    setRecordDetail(null);
    setActiveForm(form);
    setSidebarCollapsed(true);
  };

  const handleFormSubmit = async (form: ActiveForm, data: Record<string, any>) => {
    if (form.mode === 'add') {
      switch (form.type) {
        case 'budget':
          await addBudget(companyId, data as Omit<Budget, 'id'>);
          break;
        case 'ejecucion':
          await addEjecucion(companyId, data as Omit<Ejecucion, 'id'>);
          break;
        case 'project':
          await addProject(companyId, data as Omit<Project, 'id'>);
          break;
        case 'client':
          await addClient(data as Omit<Client, 'id'>);
          break;
        case 'provider':
          await addProvider(data as Omit<Provider, 'id'>);
          break;
      }
    } else {
      switch (form.type) {
        case 'budget':
          await updateBudget(companyId, form.record.id, data as Partial<Budget>);
          break;
        case 'ejecucion':
          await updateEjecucion(companyId, form.record.id, data as Partial<Ejecucion>);
          break;
        case 'project':
          await updateProject(companyId, form.record.id, data as Partial<Project>);
          break;
        case 'client':
          await updateClient(form.record.id, data as Partial<Client>);
          break;
        case 'provider':
          await updateProvider(form.record.id, data as Partial<Provider>);
          break;
      }
    }
    closePanel();
  };

  const handleSidepanelClose = () => closePanel();

  return (
    <CompanyProvider companyId={companyId}>
      <div className="flex h-screen w-full bg-[#F4F6F8] text-slate-900 font-sans overflow-hidden select-none">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} activeView={activeView}
          onViewChange={(view) => navigateTo(view)} basePath={`/${companyId}`} />

        <main className="flex-1 flex overflow-hidden relative min-w-0">
          <div className="flex-1 overflow-hidden flex flex-col bg-transparent">
            {activeView === 'Dashboard' && (
              <Dashboard onCellClick={handleCellClick} budgets={budgets} ejecuciones={ejecuciones} />
            )}
            {activeView === 'Datos' && (
              <Datos budgets={budgets} ejecuciones={ejecuciones} activeTab={activeTab}
                onTabChange={(tab) => navigateTo('Datos', tab)} companyId={companyId}
                onViewRecord={handleViewRecord} onAddNew={handleAddNew} onEditRecord={handleEditRecord} />
            )}
            {['Proyectos', 'Proveedores', 'Clientes', 'Extractos'].includes(activeView) && (
              <Construction view={activeView} />
            )}
          </div>

          <Sidepanel data={sidepanelData} recordDetail={recordDetail} activeForm={activeForm}
            companyId={companyId} onClose={handleSidepanelClose} onFormSubmit={handleFormSubmit} />
        </main>
      </div>
    </CompanyProvider>
  );
}
