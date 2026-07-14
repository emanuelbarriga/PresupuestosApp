'use client'

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ViewType, SidepanelData, Budget, Ejecucion, Comprobante, Project, Client, Provider, RecordDetail, ActiveForm, FormType, NavScreen, EntityType, Month, TransactionType, MONTHS, CuentaBancaria, ExtractoBancario, ErConfig } from '@/lib/types';
import { db, storage } from '@/lib/firebase';
import { collection, doc, writeBatch, serverTimestamp, increment, arrayUnion, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
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
  addCuentaBancaria,
  updateCuentaBancaria,
  addExtracto,
  updateExtracto,
  batchAddMovimientos,
  updateExtractoStatus,
  updateMovimiento,
  deleteBudget, deleteEjecucion, deleteTercero,
  getErConfig, saveErConfig,
} from '@/lib/firestore';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Datos } from '@/components/Datos';
import { Construction } from '@/components/Construction';
import { Configuracion } from '@/components/Configuracion';
import { EstadoResultados } from '@/components/EstadoResultados';
import { Extractos } from '@/components/Extractos';
import { CommandPalette } from '@/components/CommandPalette';
import { Sidepanel } from '@/components/Sidepanel';
import { MediaPage } from '@/components/media/MediaPage';
import { Company } from '@/lib/types';
import { DEFAULT_ER_CONFIG } from '@/lib/er-config-defaults';

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
  if (main === 'media') return { view: 'Media' };
  if (main === 'estado-resultados') return { view: 'EstadoResultados' };
  if (main === 'configuracion') return { view: 'Configuración' };
  return { view: 'Dashboard' };
}

/**
 * Find an unconverted bank movement that matches an ejecucion by cuenta + fecha + monto + tipo.
 * Scans extractos for the given cuenta and returns the first matching movimiento.
 * Returns null if no unique match is found.
 */
async function findMatchingMovimiento(
  companyId: string,
  cuentaId: string,
  fecha: string,
  monto: number,
  tipo: string,
): Promise<{ extractoId: string; movimientoId: string } | null> {
  try {
    const extractosSnap = await getDocs(
      collection(db, 'companies', companyId, 'cuentasBancarias', cuentaId, 'extractos'),
    );

    for (const extDoc of extractosSnap.docs) {
      const extractoId = extDoc.id;
      const movimientosSnap = await getDocs(
        collection(db, 'companies', companyId, 'cuentasBancarias', cuentaId, 'extractos', extractoId, 'movimientos'),
      );

      for (const movDoc of movimientosSnap.docs) {
        const mov = movDoc.data();
        // Skip already converted
        if (mov.convertido) continue;
        // Match fecha
        if (mov.fecha !== fecha) continue;
        // Match monto by tipo (debito for egreso, credito for ingreso)
        const montoMov = tipo === 'egreso' ? mov.debito : mov.credito;
        if (montoMov !== monto) continue;
        // Found a match
        return { extractoId, movimientoId: movDoc.id };
      }
    }
  } catch (err) {
    console.error('[findMatchingMovimiento] error:', err);
  }
  return null;
}

export default function CompanyPage({ params }: Props) {
  const { company: companyId, segments } = use(params);
  const router = useRouter();
  const { view: activeView, tab: activeTab } = viewFromSegments(segments);
  const [navStack, setNavStack] = useState<NavScreen[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Dashboard customization state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState('');

  // ER Config state
  const [erConfig, setErConfig] = useState<ErConfig | null>(null);
  const [erDraftConfig, setErDraftConfig] = useState<ErConfig | null>(null);
  const [erConfigLoading, setErConfigLoading] = useState(true);

  const current = navStack[navStack.length - 1];
  const canGoBack = navStack.length > 1;

  const isConjunto = companyId === 'all';

  // Load companies list for conjunto mode
  useEffect(() => {
    if (isConjunto) {
      const unsub = subscribeCompanies(
        (data) => setCompanies(data),
        () => {},
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
          () => {},
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
          () => {},
        );
        
        unsubs.push(unsubBudgets, unsubEjecuciones);
      });
      
      return () => unsubs.forEach((u) => u());
    } else {
      // Single company mode
      const unsubs = [
        subscribeBudgets(companyId, setBudgets, () => {}),
        subscribeEjecuciones(companyId, setEjecuciones, () => {}),
      ];
      return () => unsubs.forEach((u) => u());
    }
  }, [companyId, isConjunto, companies]);

  // Load projects for single company mode
  useEffect(() => {
    if (isConjunto) return;
    const unsub = subscribeProjects(companyId, setProjects, () => {});
    return () => unsub();
  }, [companyId, isConjunto]);

  // Load ER config for single company mode
  useEffect(() => {
    if (isConjunto) return;
    setErConfigLoading(true);
    getErConfig(companyId)
      .then(config => {
        setErConfig(config || DEFAULT_ER_CONFIG);
        setErConfigLoading(false);
      })
      .catch(() => {
        setErConfig(DEFAULT_ER_CONFIG);
        setErConfigLoading(false);
      });
  }, [companyId, isConjunto]);

  const projectsForCompany = isConjunto ? [] : projects;

  const pushScreen = useCallback((screen: NavScreen) => {
    setNavStack(prev => [...prev, screen]);
  }, []);

  const popScreen = useCallback(() => {
    setNavStack(prev => prev.slice(0, -1));
  }, []);

  const clearScreens = useCallback(() => {
    setNavStack([]);
  }, []);

  // Auto-open create-company form when arriving with ?create-company=1
  const createTriggered = useRef(false);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (createTriggered.current) return;
    if (searchParams.get('create-company') === '1') {
      createTriggered.current = true;
      pushScreen({ type: 'entity', entity: 'compania', mode: 'create' });
    }
  }, [searchParams, pushScreen]);

  const closePanel = () => {
    setErDraftConfig(null);
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

  const handleCellClick = (data: SidepanelData) => {
    pushScreen({ type: 'entity-list', data });
  };

  const handleProjectClick = (projectId: string, projectName: string, year?: number, tipo?: TransactionType, viewMode?: 'Presupuestado' | 'Ejecutado') => {
    if (isConjunto) return;
    const found = projects.find(p => p.id === projectId) || projects.find(p => p.name === projectName);
    const project: Project = found || {
      id: projectId || '',
      name: projectName,
      clientId: '',
      clientName: '',
      estado: 'Activo',
    };
    pushScreen({ type: 'entity', entity: 'project', mode: 'view', record: project, year, filterTipo: tipo, filterMode: viewMode });
  };

  const handleCustomizeClick = () => {
    if (current?.type === 'customize') {
      popScreen();
    } else {
      pushScreen({ type: 'customize' });
    }
  };

  const handleErConfigClick = useCallback(() => {
    setErDraftConfig(null); // Clear any previous draft
    pushScreen({
      type: 'entity',
      entity: 'er-config',
      mode: 'edit',
      record: {
        config: erConfig || DEFAULT_ER_CONFIG,
        projects: projectsForCompany || [],
        onConfigChange: (draft: ErConfig) => setErDraftConfig(draft),
      },
    });
  }, [erConfig, projectsForCompany]);

  const handleErConfigChange = useCallback((draft: ErConfig) => {
    setErDraftConfig(draft);
  }, []);

  const handleEmptyCellClick = (year: number, projectId: string, projectName: string, month: Month, tipo: TransactionType, mode: 'Presupuestado' | 'Ejecutado', entityId?: string, entityName?: string, entityType?: string, value?: number) => {
    if (isConjunto) return;
    const entity = mode === 'Presupuestado' ? 'budget' as const : 'ejecucion' as const;
    const monthIndex = MONTHS.indexOf(month);
    const defaults: Record<string, string> = {
      projectName,
      tipo,
    };
    if (projectId) defaults.projectId = projectId;
    // Pre-fill montoEjecutado with the presupuestado value when clicking gray cells
    if (entity === 'ejecucion' && value !== undefined) {
      defaults.montoEjecutado = String(value);
    }
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
    const fechaStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    if (entity === 'budget') {
      defaults.mesPresupuestado = month;
      defaults.fechaEjecutado = fechaStr;
    } else {
      defaults.fechaEjecutado = fechaStr;
    }
    pushScreen({ type: 'entity', entity, mode: 'create', defaults });
  };

  const handleViewRecord = (detail: RecordDetail) => {
    const entityMap: Record<string, EntityType> = {
      budget: 'budget', ejecucion: 'ejecucion', project: 'project',
      client: 'tercero', provider: 'tercero', tercero: 'tercero',
      cuenta: 'cuenta', extracto: 'extracto',
    };
    const entity = entityMap[detail.type];
    if (entity) {
      const record = (detail as any)[detail.type] || (detail as any).project || (detail as any).client || (detail as any).provider || (detail as any).tercero;
      pushScreen({ type: 'entity', entity, mode: 'view', record });
    } else if (detail.type === 'detalle-tercero') {
      pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
    } else if (detail.type === 'settings-editor') {
      pushScreen({ type: 'entity', entity: 'settings', mode: 'edit', record: detail });
    }
  };

  const handleAddNew = (type: FormType, defaults?: Record<string, string>) => {
    const entityMap: Record<string, EntityType> = {
      budget: 'budget', ejecucion: 'ejecucion', project: 'project',
      client: 'tercero', provider: 'tercero', tercero: 'tercero',
      cuenta: 'cuenta', extracto: 'extracto',
      'invite-user': 'invitacion', 'edit-user-role': 'colaborador', 'create-company': 'compania',
    };
    const entity = entityMap[type];
    if (entity) pushScreen({ type: 'entity', entity, mode: 'create', defaults });
  };

  const handleEditRecord = (form: ActiveForm) => {
    const entityMap: Record<string, EntityType> = {
      budget: 'budget', ejecucion: 'ejecucion', project: 'project',
      client: 'tercero', provider: 'tercero', tercero: 'tercero',
      cuenta: 'cuenta', extracto: 'extracto',
      'invite-user': 'invitacion', 'edit-user-role': 'colaborador',
    };
    const entity = entityMap[form.type];
    if (entity) pushScreen({ type: 'entity', entity, mode: 'edit', record: (form as any).record });
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      await deleteBudget(companyId, budgetId);
    } catch (err) {
      toast.error('Error al borrar el presupuesto. Intentá de nuevo.');
    }
  };

  const handleDeleteEjecucion = async (ejecucionId: string) => {
    try {
      await deleteEjecucion(companyId, ejecucionId);
    } catch (err) {
      toast.error('Error al borrar la ejecución. Intentá de nuevo.');
    }
  };

  const handleDeleteTercero = async (terceroId: string) => {
    try {
      await deleteTercero(terceroId);
    } catch (err) {
      toast.error('Error al borrar el tercero. Intentá de nuevo.');
    }
  };

  const handleTerceroClick = (detail: RecordDetail) => {
    if (isConjunto) return;
    if (detail.type === 'detalle-tercero') {
      pushScreen({ id: crypto.randomUUID(), type: 'view', detail });
    }
  };

  const handleFormSubmit = async (form: ActiveForm, data: Record<string, any>) => {
    // In conjunto mode, we need to determine which company to use
    // For now, disable editing in conjunto mode
    if (isConjunto) {
      closePanel();
      return;
    }

    if (form.mode === 'add') {
      switch (form.type) {
        case 'budget':
          await addBudget(companyId, data as Omit<Budget, 'id'>);
          break;
        case 'ejecucion': {
          const preGeneratedId = data._preGeneratedId as string | undefined;
          const budgetLinks = data._budgetLinks as Array<{ budgetId: string; monto: number }> | undefined;
          // Mark movimiento as converted (from Extractos flow)
          let movCuentaId = data._cuentaId as string | undefined;
          let movExtractoId = data._extractoId as string | undefined;
          let movMovimientoId = data._movimientoId as string | undefined;
          delete data._preGeneratedId;
          delete data._budgetLinks;
          delete data._cuentaId;
          delete data._extractoId;
          delete data._movimientoId;
          // Auto-match: when creating from EjecucionForm with cuentaId but no explicit movimiento refs
          if (!movCuentaId && !movExtractoId && !movMovimientoId && data.cuentaId) {
            try {
              const match = await findMatchingMovimiento(
                companyId, data.cuentaId,
                data.fechaEjecutado, data.montoEjecutado, data.tipo,
              );
              if (match) {
                movCuentaId = data.cuentaId;
                movExtractoId = match.extractoId;
                movMovimientoId = match.movimientoId;
              }
            } catch (err) {
              console.error('[page] auto-match movimiento falló:', err);
            }
          }
          // Use writeBatch for atomic creation of ejecucion + budgetLinks + budget totals
          const batch = writeBatch(db);
          const ejecucionRef = preGeneratedId
            ? doc(db, 'companies', companyId, 'ejecuciones', preGeneratedId)
            : doc(collection(db, 'companies', companyId, 'ejecuciones'));
          batch.set(ejecucionRef, {
            ...data,
            createdAt: serverTimestamp(),
            ...(movMovimientoId ? { _movimientoId: movMovimientoId, _extractoId: movExtractoId } : {}),
          });
          if (budgetLinks && budgetLinks.length > 0) {
            for (const link of budgetLinks) {
              const linkRef = doc(collection(db, ejecucionRef.path, 'budgetLinks'));
              batch.set(linkRef, {
                companyId,
                budgetId: link.budgetId,
                monto: link.monto,
                createdAt: serverTimestamp(),
              });
              // Denormalize on the budget: totalEjecutado + linkedEjecuciones
              const budgetRef = doc(db, 'companies', companyId, 'budgets', link.budgetId);
              batch.update(budgetRef, {
                totalEjecutado: increment(link.monto),
                linkedEjecuciones: arrayUnion({ ejecucionId: ejecucionRef.id, monto: link.monto }),
              });
            }
          }
          await batch.commit();
          // Mark movimiento as converted and store ejecucion ID
          if (movCuentaId && movExtractoId && movMovimientoId) {
            updateMovimiento(companyId, movCuentaId, movExtractoId, movMovimientoId, { convertido: true, _ejecucionId: ejecucionRef.id }).catch((err) => console.error('[page] updateMovimiento falló:', err));
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
        case 'cuenta':
          await addCuentaBancaria(companyId, data as Omit<CuentaBancaria, 'id'>);
          break;
        case 'extracto': {
          const pendingMovs = data._pendingMovimientos ? (data._pendingMovimientos as any[]) : undefined;
          const pendingSaldoFinal = data._pendingSaldoFinal as number | undefined;
          delete data._pendingMovimientos;
          delete data._pendingSaldoFinal;

          const extractoId = await addExtracto(companyId, data.accountId, data as Omit<ExtractoBancario, 'id'>);

          // Save pre-parsed movements in one go
          if (pendingMovs && pendingMovs.length > 0) {
            await batchAddMovimientos(companyId, data.accountId, extractoId, pendingMovs);
            const totalMov = pendingMovs.length;
            // Update saldoFinal with the parsed value (source of truth)
            await updateExtractoStatus(companyId, data.accountId, extractoId, 'Completado', {
              totalMovimientosParseados: totalMov,
              saldoInicial: Number(data.saldoInicial) || 0,
              saldoFinal: pendingSaldoFinal ?? (Number(data.saldoFinal) || 0),
            });
          }
          break;
        }
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
          await updateTercero(form.record.id, data, companyId);
          break;
        case 'cuenta':
          await updateCuentaBancaria(companyId, (form as any).record.id, data as Partial<CuentaBancaria>);
          break;
        case 'extracto': {
          const r = (form as any).record;
          await updateExtracto(companyId, r.accountId, r.id, data as Partial<ExtractoBancario>);
          break;
        }
      }
    }
    popScreen();
  };

  const handleEntitySubmit = useCallback(async (action: {
    mode: 'create' | 'edit' | 'archive' | 'delete';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => {
    // Handle ER config save directly
    if (action.entity === 'er-config') {
      const config = action.data as unknown as ErConfig;
      await saveErConfig(companyId, config);
      setErConfig(config);
      setErDraftConfig(null);
      toast.success('Configuración ER guardada');
      popScreen();
      return;
    }

    if (action.mode === 'archive') {
      if (action.entity === 'budget' && action.record?.id) {
        await updateBudget(companyId, action.record.id, { archivado: action.data.archivado });
      } else if (action.entity === 'ejecucion' && action.record?.id) {
        await updateEjecucion(companyId, action.record.id, { archivado: action.data.archivado });
      }
      return;
    }

    if (action.mode === 'delete') {
      if (action.entity === 'budget' && action.record?.id) {
        await deleteBudget(companyId, action.record.id);
        toast.success('Presupuesto eliminado');
      } else if (action.entity === 'ejecucion' && action.record?.id) {
        await deleteEjecucion(companyId, action.record.id);
        toast.success('Ejecución eliminada');
      }
      return;
    }

    if (action.mode === 'create' || action.mode === 'edit') {
      const formTypeMap: Partial<Record<EntityType, FormType>> = {
        budget: 'budget', ejecucion: 'ejecucion', project: 'project',
        tercero: 'tercero', cuenta: 'cuenta', extracto: 'extracto',
        invitacion: 'invite-user', colaborador: 'edit-user-role', compania: 'create-company',
      };
      const formType = formTypeMap[action.entity];
      if (formType) {
        const activeForm: ActiveForm = action.mode === 'edit'
          ? { mode: 'edit', type: formType as any, record: action.record }
          : { mode: 'add', type: formType };
        await handleFormSubmit(activeForm, action.data);
      }
    }
  }, [companyId, handleFormSubmit, popScreen]);

  const handleSaveComprobantes = useCallback(async (ejecucionId: string, comprobantes: Comprobante[]) => {
    await updateEjecucion(companyId, ejecucionId, { comprobantes: JSON.parse(JSON.stringify(comprobantes)) });
  }, [companyId]);

  const handleSidepanelClose = () => closePanel();

  const handleSidepanelBack = () => popScreen();

  return (
    <div className="flex h-screen w-full bg-[#F4F6F8] text-slate-900 font-sans overflow-hidden select-none">
        <Sidebar activeView={activeView} basePath={`/${companyId}`} />

        <main className="flex-1 flex overflow-hidden relative min-w-0">
          <div className="flex-1 overflow-hidden flex flex-col bg-transparent">
            {activeView === 'Dashboard' && (
              <Dashboard onCellClick={handleCellClick} onProjectClick={handleProjectClick} onEmptyCellClick={handleEmptyCellClick} onTerceroClick={handleTerceroClick} onCustomizeClick={handleCustomizeClick} budgets={budgets} ejecuciones={ejecuciones} projects={projectsForCompany} selectedProjects={selectedProjects} />
            )}
            {activeView === 'Datos' && (
              <Datos budgets={budgets} ejecuciones={ejecuciones} activeTab={activeTab}
                onTabChange={(tab) => navigateTo('Datos', tab)} companyId={companyId}
                companyName={companies.find(c => c.id === companyId)?.name}
                onViewRecord={handleViewRecord} onAddNew={handleAddNew} onEditRecord={handleEditRecord}
                onDeleteEjecucion={handleDeleteEjecucion} onDeleteTercero={handleDeleteTercero}
                onNavigate={(screen) => pushScreen(screen)} />
            )}
            {activeView === 'EstadoResultados' && (
              <EstadoResultados
                budgets={budgets}
                ejecuciones={ejecuciones}
                projects={projectsForCompany}
                erConfig={erDraftConfig || erConfig || undefined}
                onErConfigClick={handleErConfigClick}
              />
            )}
            {activeView === 'Extractos' && (
              <Extractos companyId={companyId} onNavigate={(screen) => pushScreen(screen)} />
            )}
            {activeView === 'Media' && (
              <MediaPage companyId={companyId} onNavigate={pushScreen} />
            )}
            {['Proyectos', 'Proveedores', 'Clientes'].includes(activeView) && (
              <Construction view={activeView} />
            )}
            {activeView === 'Configuración' && (
              <Configuracion onAddNew={handleAddNew} onEditRecord={handleEditRecord} />
            )}
          </div>

          <Sidepanel screen={current}
            companyId={companyId} onClose={handleSidepanelClose}
            onSubmit={handleEntitySubmit}
            canGoBack={canGoBack}
            activeView={activeView}
            onBack={handleSidepanelBack}
            onNavigate={pushScreen}
            projects={projectsForCompany}
            selectedProjects={selectedProjects}
            projectSearch={projectSearch}
            onProjectsChange={setSelectedProjects}
            onSearchChange={setProjectSearch} />
        </main>
        <CommandPalette onNavigate={(view, tab) => navigateTo(view, tab)} onAddNew={(type, defaults) => handleAddNew(type, defaults)} />
      </div>
  );
}
