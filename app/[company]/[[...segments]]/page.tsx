'use client'

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ViewType, SidepanelData, Budget, Ejecucion, Comprobante, Project, Client, Provider, RecordDetail, ActiveForm, FormType, NavScreen, Month, TransactionType, MONTHS } from '@/lib/types';
import { uploadFile, generateFilePath } from '@/lib/fileUpload';
import { CompanyProvider } from '@/context/CompanyContext';
import {
  subscribeBudgets,
  subscribeEjecuciones,
  subscribeProjects,
  addBudget,
  addEjecucion,
  addClient,
  addProvider,
  addProject,
  addTercero,
  updateBudget,
  updateEjecucion,
  updateClient,
  updateProvider,
  updateProject,
  updateTercero,
  subscribeCompanies,
} from '@/lib/firestore';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Datos } from '@/components/Datos';
import { Construction } from '@/components/Construction';
import { EstadoResultados } from '@/components/EstadoResultados';
import { Sidepanel } from '@/components/Sidepanel';
import { Company } from '@/lib/types';

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
  if (main === 'estado-resultados') return { view: 'EstadoResultados' };
  return { view: 'Dashboard' };
}

export default function CompanyPage({ params }: Props) {
  const { company: companyId, segments } = use(params);
  const router = useRouter();
  const { view: activeView, tab: activeTab } = viewFromSegments(segments);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navStack, setNavStack] = useState<NavScreen[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Dashboard customization state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState('');

  const current = navStack[navStack.length - 1];
  const sidepanelData = current?.type === 'data' ? current.data : null;
  const recordDetail = current?.type === 'view' ? current.detail : null;
  const activeForm = current?.type === 'form' ? current.form : null;
  const customizeOpen = current?.type === 'customize';
  const canGoBack = navStack.length > 1;

  const isConjunto = companyId === 'all';

  // Load companies list for conjunto mode
  useEffect(() => {
    if (isConjunto) {
      const unsub = subscribeCompanies(
        (data) => setCompanies(data),
        (err) => console.error('Error loading companies:', err),
      );
      return () => unsub();
    }
  }, [isConjunto]);

  // Load budgets and ejecuciones
  useEffect(() => {
    if (isConjunto) {
      // In conjunto mode, load from all companies
      const unsubs: (() => void)[] = [];
      
      companies.forEach((company) => {
        const unsubBudgets = subscribeBudgets(
          company.id,
          (companyBudgets) => {
            setBudgets((prev) => {
              const filtered = prev.filter((b) => !b.id.startsWith(company.id + '_'));
              const tagged = companyBudgets.map((b) => ({ ...b, id: company.id + '_' + b.id, _companyId: company.id }));
              return [...filtered, ...tagged];
            });
          },
          (err) => console.error(`Error loading budgets for ${company.id}:`, err),
        );
        
        const unsubEjecuciones = subscribeEjecuciones(
          company.id,
          (companyEjecuciones) => {
            setEjecuciones((prev) => {
              const filtered = prev.filter((e) => !e.id.startsWith(company.id + '_'));
              const tagged = companyEjecuciones.map((e) => ({ ...e, id: company.id + '_' + e.id, _companyId: company.id }));
              return [...filtered, ...tagged];
            });
          },
          (err) => console.error(`Error loading ejecuciones for ${company.id}:`, err),
        );
        
        unsubs.push(unsubBudgets, unsubEjecuciones);
      });
      
      return () => unsubs.forEach((u) => u());
    } else {
      // Single company mode
      const unsubs = [
        subscribeBudgets(companyId, setBudgets, (err) => console.error('Error loading budgets:', err)),
        subscribeEjecuciones(companyId, setEjecuciones, (err) => console.error('Error loading ejecuciones:', err)),
      ];
      return () => unsubs.forEach((u) => u());
    }
  }, [companyId, isConjunto, companies]);

  // Load projects for single company mode
  useEffect(() => {
    if (isConjunto) return;
    const unsub = subscribeProjects(companyId, setProjects, (err) => console.error('Error loading projects:', err));
    return () => unsub();
  }, [companyId, isConjunto]);

  const projectsForCompany = isConjunto ? [] : projects;

  const pushScreen = useCallback((screen: NavScreen) => {
    setNavStack(prev => [...prev, screen]);
    setSidebarCollapsed(true);
  }, []);

  const popScreen = useCallback(() => {
    setNavStack(prev => prev.slice(0, -1));
  }, []);

  const clearScreens = useCallback(() => {
    setNavStack([]);
    setSidebarCollapsed(false);
  }, []);

  const closePanel = () => {
    clearScreens();
  };

  const navigateTo = (view: ViewType, tab?: string) => {
    closePanel();
    let path = `/${companyId}`;
    if (view === 'Dashboard') path += '/dashboard';
    else if (view === 'Datos') path += `/datos${tab ? `/${tab.toLowerCase()}` : ''}`;
    else if (view === 'EstadoResultados') path += '/estado-resultados';
    else path += `/${view.toLowerCase()}`;
    router.push(path);
  };

  const handleSidebarToggle = () => {
    const newCollapsedState = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsedState);
    if (!newCollapsedState) closePanel();
  };

  const handleCellClick = (data: SidepanelData) => {
    pushScreen({ id: crypto.randomUUID(), type: 'data', data });
  };

  const handleProjectClick = (projectId: string, projectName: string) => {
    if (isConjunto) return;
    const found = projects.find(p => p.id === projectId) || projects.find(p => p.name === projectName);
    const project: Project = found || {
      id: projectId || '',
      name: projectName,
      clientId: '',
      clientName: '',
      estado: 'Activo',
    };
    const relatedBudgets = budgets.filter(b => (b.projectId && b.projectId === projectId) || (!b.projectId && b.projectName === projectName));
    const relatedEjecuciones = ejecuciones.filter(e => (e.projectId && e.projectId === projectId) || (!e.projectId && e.projectName === projectName));
    const detail: RecordDetail = {
      type: 'project',
      project,
      budgets: relatedBudgets,
      ejecuciones: relatedEjecuciones,
    };
    pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
  };

  const handleCustomizeClick = () => {
    if (current?.type === 'customize') {
      popScreen();
    } else {
      pushScreen({ id: crypto.randomUUID(), type: 'customize' });
    }
  };

  const handleEmptyCellClick = (projectId: string, projectName: string, month: Month, tipo: TransactionType, mode: 'Presupuestado' | 'Ejecutado', entityId?: string, entityName?: string, entityType?: string) => {
    if (isConjunto) return;
    const formType = mode === 'Presupuestado' ? 'budget' : 'ejecucion';
    const monthIndex = MONTHS.indexOf(month);
    const currentYear = new Date().getFullYear();
    const defaults: Record<string, string> = {
      projectName,
      tipo,
    };
    if (projectId) defaults.projectId = projectId;
    // Use entity info from tercero cell if provided, otherwise resolve from project
    if (entityName) {
      defaults.entityName = entityName;
      defaults.entityType = entityType || 'client';
      if (entityId) defaults.entityId = entityId;
    } else {
      const project = projects.find(p => p.id === projectId || p.name === projectName);
      if (project?.clientName) {
        defaults.entityName = project.clientName;
        defaults.entityType = 'client';
      }
    }
    if (formType === 'budget') {
      defaults.mesPresupuestado = month;
      defaults.fechaEjecutado = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    } else {
      defaults.fechaEjecutado = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    }
    pushScreen({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: formType, defaults } });
  };

  const handleViewRecord = (detail: RecordDetail) => {
    pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
  };

  const handleAddNew = (type: FormType) => {
    pushScreen({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type } });
  };

  const handleEditRecord = (form: ActiveForm) => {
    pushScreen({ id: crypto.randomUUID(), type: 'form', form });
  };

  const handleTerceroClick = (detail: RecordDetail) => {
    if (isConjunto) return;
    pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
  };

  const handleFormSubmit = async (form: ActiveForm, data: Record<string, any>) => {
    // In conjunto mode, we need to determine which company to use
    // For now, disable editing in conjunto mode
    if (isConjunto) {
      console.warn('Editing is disabled in conjunto mode');
      closePanel();
      return;
    }

    if (form.mode === 'add') {
      switch (form.type) {
        case 'budget':
          await addBudget(companyId, data as Omit<Budget, 'id'>);
          break;
        case 'ejecucion': {
          const pendingFiles = data._pendingComprobantes as Array<{ id: string; file: File; name: string; type: string; size: number; descripcion?: string; tipo?: string }> | undefined;
          delete data._pendingComprobantes;
          const docId = await addEjecucion(companyId, data as Omit<Ejecucion, 'id'>);
          if (pendingFiles && pendingFiles.length > 0) {
            const comprobantes: Comprobante[] = await Promise.all(
              pendingFiles.map(async (pf) => {
                const path = generateFilePath(companyId, docId, pf.name);
                const result = await uploadFile(pf.file, path);
                return {
                  id: crypto.randomUUID(),
                  name: pf.name,
                  url: result.url,
                  path: result.path,
                  type: pf.type,
                  size: pf.size,
                  uploadedAt: new Date().toISOString(),
                  ...(pf.descripcion ? { descripcion: pf.descripcion } : {}),
                  ...(pf.tipo ? { tipo: pf.tipo } : {}),
                };
              }),
            );
            await updateEjecucion(companyId, docId, { comprobantes: JSON.parse(JSON.stringify(comprobantes)) });
          }
          break;
        }
        case 'project':
          await addProject(companyId, data as Omit<Project, 'id'>);
          break;
        case 'client':
          await addClient(data as Omit<Client, 'id'>);
          break;
        case 'provider':
          await addProvider(data as Omit<Provider, 'id'>);
          break;
        case 'tercero':
          await addTercero(data);
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
          if (data.estado && form.record) {
            const projectId = (form.record as Project).id;
            setBudgets(prev => prev.map(b =>
              b.projectId === projectId ? { ...b, estadoProyecto: data.estado } : b
            ));
          }
          break;
        case 'client':
          await updateClient(form.record.id, data as Partial<Client>);
          break;
        case 'provider':
          await updateProvider(form.record.id, data as Partial<Provider>);
          break;
        case 'tercero':
          await updateTercero(form.record.id, data);
          break;
      }
    }
    popScreen();
  };

  const handleSidepanelClose = () => closePanel();

  const handleSidepanelBack = () => popScreen();

  return (
    <CompanyProvider companyId={companyId}>
      <div className="flex h-screen w-full bg-[#F4F6F8] text-slate-900 font-sans overflow-hidden select-none">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} activeView={activeView}
          onViewChange={(view) => navigateTo(view)} basePath={`/${companyId}`} />

        <main className="flex-1 flex overflow-hidden relative min-w-0">
          <div className="flex-1 overflow-hidden flex flex-col bg-transparent">
            {activeView === 'Dashboard' && (
              <Dashboard onCellClick={handleCellClick} onProjectClick={handleProjectClick} onEmptyCellClick={handleEmptyCellClick} onTerceroClick={handleTerceroClick} onCustomizeClick={handleCustomizeClick} budgets={budgets} ejecuciones={ejecuciones} projects={projectsForCompany} selectedProjects={selectedProjects} />
            )}
            {activeView === 'Datos' && (
              <Datos budgets={budgets} ejecuciones={ejecuciones} activeTab={activeTab}
                onTabChange={(tab) => navigateTo('Datos', tab)} companyId={companyId}
                onViewRecord={handleViewRecord} onAddNew={handleAddNew} onEditRecord={handleEditRecord} />
            )}
            {activeView === 'EstadoResultados' && (
              <EstadoResultados budgets={budgets} ejecuciones={ejecuciones} projects={projectsForCompany} />
            )}
            {['Proyectos', 'Proveedores', 'Clientes', 'Extractos'].includes(activeView) && (
              <Construction view={activeView} />
            )}
          </div>

          <Sidepanel data={sidepanelData} recordDetail={recordDetail} activeForm={activeForm} customizeOpen={customizeOpen}
            companyId={companyId} onClose={handleSidepanelClose} onFormSubmit={handleFormSubmit}
            onCellClick={handleCellClick}
            canGoBack={canGoBack}
            onBack={handleSidepanelBack}
            onNavigate={pushScreen}
            projects={projectsForCompany}
            selectedProjects={selectedProjects}
            projectSearch={projectSearch}
            onProjectsChange={setSelectedProjects}
            onSearchChange={setProjectSearch} />
        </main>
      </div>
    </CompanyProvider>
  );
}
