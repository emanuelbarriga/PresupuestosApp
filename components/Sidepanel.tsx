'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { SidepanelData, Budget, Ejecucion, Comprobante, RecordDetail, ActiveForm, NavScreen, MONTHS, Month, Project, Client, Tercero, SettingsCategorias, SettingsItem, DetalleTerceroGroup } from '@/lib/types';
import { formatThousands, unformatThousands } from '@/lib/utils';
import { subscribeClients, subscribeProviders, subscribeBudgets, subscribeTerceros, subscribeSettings, updateEjecucion, updateBudget, addEjecucion, addClient, addProject, addTercero, updateSettings, createInvitation } from '@/lib/firestore';
import { validateFile, uploadFile, deleteFile, generateFilePath } from '@/lib/fileUpload';
import { X, FileText, Bell, Settings, Filter, ChevronDown, ChevronUp, Plus, Search, Link2, Unlink, Save, Trash2, Download, Upload, Paperclip, ArrowLeft, Shield, User, Send, Mail } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PendingComprobante {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  descripcion?: string;
  tipo?: string;
}

interface SidepanelProps {
  data: SidepanelData | null;
  recordDetail: RecordDetail | null;
  activeForm: ActiveForm | null;
  customizeOpen?: boolean;
  companyId: string;
  onClose: () => void;
  onFormSubmit: (form: ActiveForm, data: Record<string, any>) => Promise<void>;
  onCellClick?: (data: SidepanelData) => void;
  projects?: Project[];

  // Customization state (optional for backward compat)
  selectedProjects?: Set<string>;
  projectSearch?: string;
  onProjectsChange?: (selected: Set<string>) => void;
  onSearchChange?: (search: string) => void;

  // Navigation stack props
  canGoBack: boolean;
  onBack: () => void;
  onNavigate: (screen: NavScreen) => void;
}

function PanelHeader({ title, canGoBack, onBack, onClose }: { title: string; canGoBack: boolean; onBack: () => void; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {canGoBack && (
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
      </div>
      <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
        <X size={20} className="text-slate-400" />
      </button>
    </div>
  );
}

export function Sidepanel({ data, recordDetail, activeForm, customizeOpen = false, companyId, onClose, onFormSubmit, onCellClick, projects, selectedProjects = new Set(), projectSearch = '', onProjectsChange, onSearchChange, canGoBack, onBack, onNavigate }: SidepanelProps) {
  const visible = data || recordDetail || activeForm || customizeOpen;

  return (
    <aside className={clsx("bg-white border-l border-slate-200 flex flex-col h-full transition-all duration-300 ease-out shrink-0 overflow-hidden relative", visible ? "w-[360px]" : "w-16 items-center py-4")}>
      {!visible ? (
        <div className="flex flex-col gap-6 w-full items-center text-slate-400">
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"><FileText size={20} /></button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"><Filter size={20} /></button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"><Bell size={20} /></button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl mt-auto"><Settings size={20} /></button>
        </div>
      ) : activeForm ? (
        <FormPanel form={activeForm} companyId={companyId} onClose={onClose} onSubmit={onFormSubmit} projects={projects} onBack={onBack} canGoBack={canGoBack} />
      ) : recordDetail ? (
        <ViewPanel recordDetail={recordDetail} companyId={companyId} onClose={onClose} onFormSubmit={onFormSubmit} onCellClick={onCellClick} projects={projects} onNavigate={onNavigate} canGoBack={canGoBack} onBack={onBack} />
      ) : customizeOpen ? (
        <CustomizePanel projects={projects || []} selectedProjects={selectedProjects} projectSearch={projectSearch}
          onProjectsChange={onProjectsChange} onSearchChange={onSearchChange}
          canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      ) : data ? (
        <DataPanel data={data} companyId={companyId} onClose={onClose} projects={projects} onNavigate={onNavigate} canGoBack={canGoBack} onBack={onBack} />
      ) : null}
    </aside>
  );
}

function CustomizePanel({ projects, selectedProjects, projectSearch, onProjectsChange, onSearchChange, canGoBack, onBack, onClose }: {
  projects: Project[];
  selectedProjects: Set<string>;
  projectSearch: string;
  onProjectsChange?: (selected: Set<string>) => void;
  onSearchChange?: (search: string) => void;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = [...projects]
    .filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || (p.descripcion || '').toLowerCase().includes(projectSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleProject = (key: string) => {
    const next = new Set(selectedProjects);
    if (next.has(key)) next.delete(key); else next.add(key);
    onProjectsChange?.(next);
    setShowDropdown(false);
    setActiveIndex(-1);
    onSearchChange?.('');
  };

  const removeProject = (key: string) => {
    const next = new Set(selectedProjects);
    next.delete(key);
    onProjectsChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        const p = filtered[activeIndex];
        toggleProject(p.id || p.name);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const selectedList = projects
    .filter(p => selectedProjects.has(p.id || p.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title="Configuración de Dashboard" canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto">

        <div className="px-5 pt-4 pb-3">
          <div className="relative">
            <input type="text" placeholder="Buscar proyecto..." value={projectSearch}
              onChange={e => { onSearchChange?.(e.target.value); setShowDropdown(true); setActiveIndex(-1); }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
            {showDropdown && projectSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Sin resultados</p>
                ) : (
                  filtered.map((p, idx) => {
                    const key = p.id || p.name;
                    return (
                      <button key={key}
                        onClick={() => toggleProject(key)}
                        className={clsx("w-full text-left px-3 py-2 text-xs transition-colors", idx === activeIndex ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50")}>
                        <span className="truncate">{p.name}</span>
                        {p.descripcion && <span className="text-[10px] text-slate-400 ml-1">— {p.descripcion}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {selectedList.length > 0 && (
          <div className="px-5 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              {selectedList.length} de {projects.length} proyectos
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedList.map(p => {
                const key = p.id || p.name;
                return (
                  <span key={key}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {p.name}
                    <button onClick={() => removeProject(key)} className="hover:text-indigo-900 ml-0.5">
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {selectedProjects.size === 0 && (
          <div className="px-5 py-3">
            <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">
              Mostrando todos los proyectos. Buscá y seleccioná para filtrar.
            </p>
          </div>
        )}

        <div className="px-5 pb-4 border-t border-slate-100 mt-3 pt-3">
          <button onClick={() => { onProjectsChange?.(new Set()); onSearchChange?.(''); }}
            className="w-full text-[10px] font-bold text-indigo-600 hover:text-indigo-700 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
            Mostrar todos los proyectos
          </button>
        </div>

      </div>
    </div>
  );
}

function FormPanel({ form, companyId, onClose, onSubmit, projects, onBack, canGoBack }: { form: ActiveForm; companyId: string; onClose: () => void; onSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; projects?: Project[]; onBack: () => void; canGoBack: boolean }) {
  const { user: currentUser } = useAuth();
  const { selectedCompany, companies } = useCompany();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');

  // Terceros state for project client selector
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [showNewProjectClient, setShowNewProjectClient] = useState(false);
  const [newProjectClientName, setNewProjectClientName] = useState('');

  // Calculator & monto formatting
  const [showCalc, setShowCalc] = useState(false);
  const [montoEditing, setMontoEditing] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');

  // Recurring gastos
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(3);

  // Custom tipo/unidad for project form
  const [customTipo, setCustomTipo] = useState('');
  const [customUnidad, setCustomUnidad] = useState('');
  const [settingsData, setSettingsData] = useState<SettingsCategorias | null>(null);

  // Comprobantes state
  const [pendingComprobantes, setPendingComprobantes] = useState<PendingComprobante[]>([]);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);

  const safeProjects = projects || [];

  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  useEffect(() => {
    const unsubs = [subscribeClients(setClients), subscribeProviders(setProviders), subscribeTerceros(setTerceros), subscribeBudgets(companyId, setAllBudgets), subscribeSettings(setSettingsData)];
    return () => unsubs.forEach(u => u());
  }, [companyId]);

  // Deduplicate: terceros con tipo 'ambos' aparecen en clients y providers
  const clientsAndProviders = [
    ...clients.map(c => ({ value: c.id, label: c.name, type: 'client' as const })),
    ...providers
      .filter(p => !clients.some(c => c.id === p.id))
      .map(p => ({ value: p.id, label: p.name, type: 'provider' as const })),
    { value: '', label: 'Interno', type: 'interno' as const },
  ];

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const newId = await addClient({ name: newClientName.trim() });
    set('entityId', newId);
    set('entityName', newClientName.trim());
    set('entityType', 'client');
    setNewClientName('');
    setShowNewClient(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const newId = await addProject(companyId, { name: newProjectName.trim(), clientName: newProjectClient.trim() || 'Sin cliente', clientId: '', estado: 'Activo' });
    set('projectId', newId);
    set('projectName', newProjectName.trim());
    setNewProjectName('');
    setNewProjectClient('');
    setShowNewProject(false);
  };

  useEffect(() => {
    if (form.mode === 'edit') {
      const init: Record<string, string> = {};
      const r = form.record as any;
      Object.keys(r).forEach(k => { if (k !== 'id' && k !== 'archivado') init[k] = String(r[k] ?? ''); });
      setFields(init);
    } else {
      const init: Record<string, string> = {};
      if (form.type === 'ejecucion') {
        init.tipo = 'ingreso';
        init.fechaEjecutado = new Date().toISOString().split('T')[0];
      } else if (form.type === 'budget') {
        init.tipo = 'ingreso';
      } else if (form.type === 'client' || form.type === 'tercero') {
        init.tipo = 'cliente';
      } else if (form.type === 'provider') {
        init.tipo = 'proveedor';
      }
      // 'project' type has no automatic defaults — all fields come from the form
      if (form.defaults) Object.assign(init, form.defaults);
      setFields(init);
    }
  }, [form]);

  useEffect(() => {
    if (form.mode === 'edit' && form.type === 'ejecucion') {
      const c = form.record.comprobantes || [];
      console.log('[COMPROBANTES] Form edit ejecucion', { ejecucionId: form.record.id, comprobantesCount: c.length });
      setComprobantes(c);
    } else {
      setComprobantes([]);
      setPendingComprobantes([]);
    }
  }, [form]);

  const set = (k: string, v: string) => setFields(prev => ({ ...prev, [k]: v }));
  const f = (k: string) => fields[k] ?? '';
  const ft = form.mode === 'add' ? form.type : form.type;

  const handleDateChange = (date: string) => {
    set('fechaEjecutado', date);
    if (ft === 'budget' && date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        set('mesPresupuestado', MONTHS[parseInt(parts[1], 10) - 1] || '');
        set('fechaPresupuestado', parts[0] + '-' + parts[1]);
      }
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    const base: Record<string, any> = { ...fields };

    const addMonth = (monthName: string, count: number): string => {
      const idx = MONTHS.indexOf(monthName as Month);
      return MONTHS[(idx + count) % 12];
    };
      const addMonthToDate = (dateStr: string, count: number): string => {
        if (!dateStr) return dateStr;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        if (m < 1 || m > 12) return dateStr;
        m += count;
        while (m > 12) { m -= 12; y++; }
        while (m < 1) { m += 12; y--; }
        return `${y}-${String(m).padStart(2, '0')}-${parts[2]}`;
      };
      const addMonthToYM = (ymStr: string, count: number): string => {
        if (!ymStr) return ymStr;
        const parts = ymStr.split('-');
        if (parts.length !== 2) return ymStr;
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        if (m < 1 || m > 12) return ymStr;
        m += count;
        while (m > 12) { m -= 12; y++; }
        while (m < 1) { m += 12; y--; }
        return `${y}-${String(m).padStart(2, '0')}`;
      };

    // Compute fechaPresupuestado from mesPresupuestado if missing
    const ensureFechaPresupuestado = (d: Record<string, any>) => {
      if (d.mesPresupuestado && !d.fechaPresupuestado) {
        const monthIdx = MONTHS.indexOf(d.mesPresupuestado as Month);
        if (monthIdx >= 0) {
          // Derive year from fechaEjecutado (set as default from cell click) or fallback to current year
          const year = d.fechaEjecutado ? parseInt(d.fechaEjecutado.split('-')[0], 10) : new Date().getFullYear();
          d.fechaPresupuestado = `${isNaN(year) ? new Date().getFullYear() : year}-${String(monthIdx + 1).padStart(2, '0')}`;
        }
      }
    };

    const entries: Record<string, any>[] = [];
    const reps = recurring && form.mode === 'add' ? Math.max(1, recurringCount) : 1;

    for (let i = 0; i < reps; i++) {
      const data = { ...base };
      ensureFechaPresupuestado(data);

      if (i > 0) {
        if (ft === 'budget') {
          data.mesPresupuestado = addMonth(data.mesPresupuestado, i);
          data.fechaPresupuestado = addMonthToYM(data.fechaPresupuestado || `${new Date().getFullYear()}-01`, i);
          data.fechaEjecutado = addMonthToDate(data.fechaEjecutado, i);
        } else if (ft === 'ejecucion') {
          data.fechaEjecutado = addMonthToDate(data.fechaEjecutado, i);
        }
      }

      if (ft === 'budget' || ft === 'ejecucion') {
        if (!data.projectId) data.projectId = '';
        if (!data.projectName) data.projectName = '';
        if (!data.entityId) data.entityId = '';
        if (!data.entityName) data.entityName = '';
        if (!data.entityType) data.entityType = '';
      }
      if (ft === 'budget') { data.montoPresupuestado = Number(data.montoPresupuestado) || 0; delete data.fechaEjecutado; }
      if (ft === 'ejecucion') {
        data.montoEjecutado = Number(data.montoEjecutado) || 0;
        if (form.mode === 'add' && pendingComprobantes.length > 0) {
          data._pendingComprobantes = pendingComprobantes.map(pc => ({
            id: pc.id, file: pc.file, name: pc.name, type: pc.type, size: pc.size,
          }));
        }
      }
      if (ft === 'project') {
        data.cantidad = Number(data.cantidad) || 0;
        if (data.tipoProyectos === '__custom__') data.tipoProyectos = '';
        if (data.unidades === '__custom__') data.unidades = '';
        data.soloEgresos = data.soloEgresos === 'true';
      }

      entries.push(data);
    }

    // Submit all at once, panel pops back after ALL complete
    for (const entry of entries) {
      await onSubmit(form, entry);
    }
    setSaving(false);
    onBack();
  };

  const filteredBudgets = allBudgets.filter(b => {
    const proj = f('projectName') || f('proyectoAsignado');
    const cli = f('entityName') || f('clienteOProveedor');
    if (proj && cli) return b.projectName === proj || b.entityName === cli;
    if (proj) return b.projectName === proj;
    if (cli) return b.entityName === cli;
    return true;
  });

  const title = `${form.mode === 'add' ? 'Nuevo' : 'Editar'} ${ft === 'budget' ? 'Presupuesto' : ft === 'ejecucion' ? 'Ejecución' : ft === 'project' ? 'Proyecto' : ft === 'tercero' ? 'Tercero' : ft === 'client' ? 'Cliente' : ft === 'cuenta' ? 'Cuenta Bancaria' : ft === 'extracto' ? 'Extracto Bancario' : 'Proveedor'}`;

  if (ft === 'project') {
    const clientOptions = terceros
      .filter(t => t.tipo === 'cliente' || t.tipo === 'ambos')
      .map(t => ({ value: t.id, label: t.name, apodo: t.apodo }));
    const handleClientSelect = (v: string) => {
      const found = terceros.find(t => t.id === v);
      if (found) {
        set('clientId', found.id);
        set('clientName', found.name);
      } else if (v) {
        // Free text — user typed a new name, store as clientName only
        set('clientId', '');
        set('clientName', v);
      }
    };
    const handleCreateProjectClient = async () => {
      if (!newProjectClientName.trim()) return;
      const newId = await addTercero({ name: newProjectClientName.trim(), tipo: 'cliente' });
      set('clientId', newId);
      set('clientName', newProjectClientName.trim());
      setNewProjectClientName('');
      setShowNewProjectClient(false);
    };
    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0">
        <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <FormInput label="Sigla" value={f('name')} onChange={v => set('name', v)} />
          <FormInput label="Nombre completo" value={f('descripcion')} onChange={v => set('descripcion', v)} />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de proyecto</label>
            {f('tipoProyectos') === '__custom__' ? (
              <div className="flex gap-2">
                <input type="text" value={customTipo} onChange={e => { setCustomTipo(e.target.value); set('tipoProyectos', e.target.value); }}
                  placeholder="Nuevo tipo..." className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none" autoFocus />
                <button onClick={() => { set('tipoProyectos', ''); setCustomTipo(''); }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Volver</button>
              </div>
            ) : (
              <ColorSelect value={f('tipoProyectos')} onChange={v => set('tipoProyectos', v)}
                items={(settingsData?.tipoProyectos || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
                placeholder="Seleccionar..." allowCustom />
            )}
          </div>
          <FormInput label="Cantidad" value={f('cantidad')} onChange={v => set('cantidad', v)} type="number" />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidades</label>
            {f('unidades') === '__custom__' ? (
              <div className="flex gap-2">
                <input type="text" value={customUnidad} onChange={e => { setCustomUnidad(e.target.value); set('unidades', e.target.value); }}
                  placeholder="Nueva unidad..." className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none" autoFocus />
                <button onClick={() => { set('unidades', ''); setCustomUnidad(''); }} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Volver</button>
              </div>
            ) : (
              <ColorSelect value={f('unidades')} onChange={v => set('unidades', v)}
                items={(settingsData?.unidades || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
                placeholder="Seleccionar..." allowCustom />
            )}
          </div>
          <SearchableSelect label="Cliente" value={f('clientId') || f('clientName')} onChange={handleClientSelect}
            options={clientOptions.map(c => ({ value: c.value, label: c.label + (c.apodo ? ` (${c.apodo})` : '') }))}
            placeholder="Buscar cliente..." />
          {!showNewProjectClient && (
            <button onClick={() => setShowNewProjectClient(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
              <Plus size={12} /> Nuevo cliente rápido
            </button>
          )}
          {showNewProjectClient && (
            <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200 -mt-3">
              <input type="text" value={newProjectClientName} onChange={e => setNewProjectClientName(e.target.value)}
                placeholder="Nombre del cliente" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
              <div className="flex gap-2">
                <button onClick={handleCreateProjectClient} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
                <button onClick={() => setShowNewProjectClient(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado</label>
            <ColorSelect
              value={f('estado')}
              onChange={v => set('estado', v)}
              items={(settingsData?.stateProject || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
              placeholder="Seleccionar..."
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input type="checkbox" checked={f('soloEgresos') === 'true'} onChange={e => set('soloEgresos', e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
            <span className="text-xs font-medium text-slate-600 select-none">Solo egresos</span>
            <span className="text-[10px] text-slate-400 ml-auto">(no aparece en Ingresos)</span>
          </label>
        </div>
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    );
  }

  if (ft === 'cuenta') {
    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0">
        <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <FormInput label="Nombre" value={f('nombre')} onChange={v => set('nombre', v)} />
          <FormInput label="Banco" value={f('banco')} onChange={v => set('banco', v)} />
          <FormSelect label="Tipo" value={f('tipo')} onChange={v => set('tipo', v)}
            options={[
              { value: 'Ahorros', label: 'Ahorros' },
              { value: 'Corriente', label: 'Corriente' },
              { value: 'Tarjeta de Crédito', label: 'Tarjeta de Crédito' },
              { value: 'Caja Menor / Efectivo', label: 'Caja Menor / Efectivo' },
            ]} />
          <FormInput label="Número de cuenta" value={f('numero')} onChange={v => set('numero', v)} />
          <FormSelect label="Moneda" value={f('moneda')} onChange={v => set('moneda', v)}
            options={[
              { value: 'COP', label: 'COP' },
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
            ]} />
          <FormInput label="Saldo inicial" value={f('saldoInicial')} onChange={v => set('saldoInicial', v)} type="number" />
        </div>
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    );
  }

  if (ft === 'extracto') {
    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0">
        <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <FormSelect label="Mes" value={f('mes')} onChange={v => set('mes', v)}
            options={MONTHS.map(m => ({ value: m, label: m }))} />
          <FormInput label="Año" value={f('anio')} onChange={v => set('anio', v)} type="number" />
          <FormInput label="Saldo inicial" value={f('saldoInicial')} onChange={v => set('saldoInicial', v)} type="number" />
          <FormInput label="Saldo final" value={f('saldoFinal')} onChange={v => set('saldoFinal', v)} type="number" />
          <FormSelect label="Estado" value={f('estado')} onChange={v => set('estado', v)}
            options={[
              { value: 'Pendiente', label: 'Pendiente' },
              { value: 'En revisión', label: 'En revisión' },
              { value: 'Conciliado', label: 'Conciliado' },
            ]} />
        </div>
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    );
  }

  if (ft === 'client' || ft === 'provider' || ft === 'tercero') {
    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0">
        <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <FormInput label="Nombre *" value={f('name')} onChange={v => set('name', v)} />
          <FormInput label="Apodo" value={f('apodo')} onChange={v => set('apodo', v)} />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Naturaleza</label>
            <select value={f('naturaleza')} onChange={e => set('naturaleza', e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
              <option value="">Seleccionar...</option>
              <option value="Persona Natural">Persona Natural</option>
              <option value="Persona Jurídica">Persona Jurídica</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Documento</label>
            <select value={f('documento')} onChange={e => set('documento', e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
              <option value="">Seleccionar...</option>
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
              <option value="RUC">RUC</option>
              <option value="CI">CI</option>
              <option value="ID">ID</option>
              <option value="RFC">RFC</option>
            </select>
          </div>
          <FormInput label="Número de documento" value={f('numeroDocumento')} onChange={v => set('numeroDocumento', v)} />
          <FormInput label="Lugar" value={f('lugar')} onChange={v => set('lugar', v)} />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
            <select value={f('tipo')} onChange={e => set('tipo', e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
              <option value="cliente">Cliente</option>
              <option value="proveedor">Proveedor</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    );
  }

  // ── Invite User Form ──
  if (ft === 'invite-user') {
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'colaborador' | 'admin'>('colaborador');
    const [selectedCompanies, setSelectedCompanies] = useState<string[]>(selectedCompany ? [selectedCompany.id] : []);
    const [inviteExpiry, setInviteExpiry] = useState<1 | 3 | 7>(7);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const toggleCompany = (companyId: string) => {
      setSelectedCompanies(prev => 
        prev.includes(companyId) 
          ? prev.filter(id => id !== companyId)
          : [...prev, companyId]
      );
    };

    const handleInvite = async () => {
      if (!inviteEmail.trim()) return;
      if (selectedCompanies.length === 0) {
        setError('Seleccioná al menos una empresa');
        return;
      }
      if (!currentUser) return;
      setSaving(true);
      setError('');
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + inviteExpiry);
        
        for (const companyId of selectedCompanies) {
          const company = companies.find(c => c.id === companyId);
          if (!company) continue;
          
          await createInvitation({
            companyId: company.id,
            companyName: company.name,
            email: inviteEmail.trim(),
            role: inviteRole,
            status: 'pendiente',
            invitedBy: currentUser.uid,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
          });
        }
        setSuccess(true);
        setTimeout(() => onBack(), 1500);
      } catch (err: any) {
        setError(err?.message || 'Error al crear la invitación');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="flex flex-col h-full w-[360px] absolute inset-0">
        <PanelHeader title="Invitar colaborador" canGoBack={true} onBack={onBack} onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Send size={22} className="text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700">¡Invitación enviada!</p>
              <p className="text-xs text-slate-500 text-center">
                Se envió una invitación a <strong>{inviteEmail}</strong> como{' '}
                {inviteRole === 'admin' ? 'Administrador' : 'Colaborador'}.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Empresas *
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                  {companies.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay empresas disponibles</p>
                  ) : (
                    companies.map(company => (
                      <label
                        key={company.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCompanies.includes(company.id)}
                          onChange={() => toggleCompany(company.id)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">{company.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedCompanies.length > 0 && (
                  <p className="text-[10px] text-indigo-600 mt-1">
                    {selectedCompanies.length} empresa{selectedCompanies.length > 1 ? 's' : ''} seleccionada{selectedCompanies.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Correo electrónico *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colaborador@ejemplo.com"
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Rol</label>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setInviteRole('colaborador')}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                      inviteRole === 'colaborador'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    <User size={14} /> Colaborador
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole('admin')}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                      inviteRole === 'admin'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    <Shield size={14} /> Administrador
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {inviteRole === 'admin'
                    ? 'Puede gestionar miembros y acceder a la configuración.'
                    : 'Puede ver y editar datos de la empresa.'}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Tiempo disponible
                </label>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setInviteExpiry(1)}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                      inviteExpiry === 1
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    1 día
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteExpiry(3)}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                      inviteExpiry === 3
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    3 días
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteExpiry(7)}
                    className={clsx(
                      "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                      inviteExpiry === 7
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    1 semana
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  La invitación caducará en {inviteExpiry} día{inviteExpiry > 1 ? 's' : ''}.
                </p>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-rose-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
        {!success && (
          <div className="p-6 border-t border-slate-100 shrink-0 space-y-2">
            <button
              onClick={handleInvite}
              disabled={saving || !inviteEmail.trim() || selectedCompanies.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Send size={14} />
              {saving ? 'Enviando...' : `Enviar invitación${selectedCompanies.length > 1 ? 'es' : ''}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <TipoSwitch value={f('tipo')} onChange={v => set('tipo', v)} />
        <SearchableSelect label="Proyecto" value={f('projectId') || f('projectName')} onChange={v => {
          const p = safeProjects.find(p => p.id === v);
          if (p) { set('projectId', p.id); set('projectName', p.name); }
        }} options={safeProjects.map(p => ({ value: p.id, label: p.name }))} placeholder="Buscar proyecto..." />
        {!showNewProject && (
          <button onClick={() => setShowNewProject(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo proyecto
          </button>
        )}
        {showNewProject && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nombre del proyecto" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <input type="text" value={newProjectClient} onChange={e => setNewProjectClient(e.target.value)} placeholder="Cliente (opcional)" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateProject} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewProject(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <SearchableSelect label="Cliente / Proveedor" value={f('entityId') || f('entityName')} onChange={v => {
          if (!v) { set('entityId', ''); set('entityName', 'Interno'); set('entityType', 'interno'); return; }
          const allEntities = [...clients.map(c => ({ id: c.id, name: c.name, type: 'client' as const })), ...providers.map(p => ({ id: p.id, name: p.name, type: 'provider' as const }))];
          const entity = allEntities.find(e => e.id === v);
          if (entity) { set('entityId', entity.id); set('entityName', entity.name); set('entityType', entity.type); }
        }} options={clientsAndProviders} placeholder="Buscar cliente o proveedor..." />
        {!showNewClient && (
          <button onClick={() => setShowNewClient(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo cliente
          </button>
        )}
        {showNewClient && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del cliente" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleCreateClient} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewClient(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <FormInput label="Descripción" value={f('descripcion')} onChange={v => set('descripcion', v)} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{ft === 'budget' ? 'Monto Presupuestado' : 'Monto Ejecutado'}</label>
            <button type="button" onClick={() => { setShowCalc(!showCalc); if (!showCalc) setCalcExpr(f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado') || ''); }}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">
              🧮 Calc
            </button>
          </div>
          <input type="text" inputMode="numeric"
            value={montoEditing ? unformatThousands(f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado')) : formatThousands(f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado'))}
            onFocus={() => setMontoEditing(true)}
            onBlur={() => setMontoEditing(false)}
            onChange={e => set(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado', unformatThousands(e.target.value))}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-right" />
          {showCalc && (
            <Calculator value={calcExpr} onChange={setCalcExpr} onResult={(res) => {
              set(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado', String(res));
              setShowCalc(false);
            }} />
          )}
        </div>
        {ft === 'budget' && (
          <div>
            <FormInput label="Fecha del presupuesto" value={f('fechaEjecutado')} onChange={handleDateChange} type="date" />
            {f('mesPresupuestado') && <p className="text-[11px] text-indigo-600 font-medium mt-1">Mes calculado: {f('mesPresupuestado')}</p>}
          </div>
        )}
        {ft === 'ejecucion' && (
          <>
            <FormInput label="Fecha de ejecución" value={f('fechaEjecutado')} onChange={v => set('fechaEjecutado', v)} type="date" />
            <SearchableSelect label="Vincular presupuesto (opcional)" value={f('budgetId')} onChange={v => {
              set('budgetId', v);
              const b = allBudgets.find(b => b.id === v);
              if (b) {
                set('projectId', b.projectId);
                set('projectName', b.projectName);
                set('entityId', b.entityId);
                set('entityName', b.entityName);
                set('entityType', b.entityType);
                set('tipo', b.tipo);
              }
            }} options={filteredBudgets.map(b => ({ value: b.id, label: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}` }))} placeholder="Buscar presupuesto..." />
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Comprobantes</p>
              <ComprobanteUploader
                companyId={companyId}
                ejecucionId={form.mode === 'edit' ? (form as any).record?.id : undefined}
                comprobantes={comprobantes}
                onComprobantesChange={setComprobantes}
                mode={form.mode === 'add' ? 'add' : 'edit'}
                pendingComprobantes={pendingComprobantes}
                onPendingChange={setPendingComprobantes}
                tiposComprobante={settingsData?.tipoComprobante || []}
              />
            </div>
          </>
        )}
        {form.mode === 'add' && (ft === 'budget' || ft === 'ejecucion') && (
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 mb-3">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-xs font-medium text-slate-600 select-none">Gasto recurrente</span>
            </label>
            {recurring && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 shrink-0">Repetir por</span>
                <input type="number" min={1} max={60} value={recurringCount} onChange={e => setRecurringCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-slate-200 rounded-lg p-1.5 text-sm text-center focus:border-indigo-500 outline-none bg-white" />
                <span className="text-[11px] font-medium text-slate-500 shrink-0">meses</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

function TipoSwitch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Tipo</label>
      <div className="flex bg-slate-100 rounded-lg p-1">
        <button type="button" onClick={() => onChange('ingreso')} className={clsx("flex-1 py-2 text-xs font-bold rounded-md transition-all", value === 'ingreso' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Ingreso</button>
        <button type="button" onClick={() => onChange('egreso')} className={clsx("flex-1 py-2 text-xs font-bold rounded-md transition-all", value === 'egreso' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Egreso</button>
      </div>
    </div>
  );
}

function SearchableSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = search ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative">
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <div className="relative">
        <input type="text" value={open ? search : selected?.label || value || ''} onChange={e => { setSearch(e.target.value); setOpen(true); }} onFocus={() => { setOpen(true); setSearch(''); }} placeholder={placeholder} className="w-full border border-slate-200 rounded-lg p-2.5 pr-8 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white cursor-pointer" />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="p-3 text-xs text-slate-500 text-center">Sin resultados</p> : filtered.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }} className={clsx("w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors", o.value === value ? 'text-indigo-600 font-medium' : 'text-slate-700')}>{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ColorSelect({ value, onChange, items, placeholder, allowCustom }: {
  value: string; onChange: (v: string) => void;
  items: { name: string; color: string }[]; placeholder?: string; allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.name === value);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-left flex items-center gap-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
        {selected ? (
          <span className="px-2.5 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: selected.color + '20', color: selected.color, border: `1px solid ${selected.color}40` }}>
            {selected.name}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder || 'Seleccionar...'}</span>
        )}
        <ChevronDown size={14} className="ml-auto text-slate-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {placeholder && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 transition-colors">
                {placeholder}
              </button>
            )}
            {items.map(item => (
              <button key={item.name} type="button" onClick={() => { onChange(item.name); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors flex items-center gap-2">
                <span className="px-2.5 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: item.color + '20', color: item.color, border: `1px solid ${item.color}40` }}>
                  {item.name}
                </span>
              </button>
            ))}
            {allowCustom && (
              <button type="button" onClick={() => { onChange('__custom__'); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium border-t border-slate-100">
                + Personalizado
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TerceroGroupPanel({ projects, onCellClick, mode }: {
  projects: Array<{
    projectId: string;
    projectName: string;
    groups: DetalleTerceroGroup[];
    totalPresupuestado: number;
    totalEjecutado: number;
    diferencia: number;
  }>;
  onCellClick?: (data: SidepanelData) => void;
  mode: 'Presupuestado' | 'Ejecutado';
}) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map(p => p.projectId))
  );

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleTerceroClick = (project: typeof projects[number], group: (typeof projects[number]['groups'][number]) & DetalleTerceroGroup) => {
    const value = mode === 'Presupuestado' ? group.totalPresupuestado : group.totalEjecutado;
    onCellClick?.({
      title: `${project.projectName} / ${group.entityName}`,
      subtitle: `${mode} — ${project.projectName}`,
      formula: `Transacciones de ${group.entityName} en ${project.projectName}`,
      budgets: group.budgets,
      ejecuciones: group.ejecuciones,
      value,
      presupuestado: group.totalPresupuestado,
      ejecutado: group.totalEjecutado,
      diferencia: group.diferencia,
      mode,
      tipo: (group.budgets[0]?.tipo || group.ejecuciones[0]?.tipo || 'ingreso') as 'ingreso' | 'egreso',
    });
  };

  const EntityTypeBadge = ({ entityType }: { entityType: string }) => {
    const colors: Record<string, string> = {
      client: 'bg-blue-100 text-blue-700',
      provider: 'bg-amber-100 text-amber-700',
      interno: 'bg-purple-100 text-purple-700',
    };
    const labels: Record<string, string> = {
      client: 'Cliente',
      provider: 'Proveedor',
      interno: 'Interno',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${colors[entityType] || 'bg-slate-100 text-slate-600'}`}>
        {labels[entityType] || entityType}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <p className="text-xs text-slate-500 italic text-center py-6 bg-slate-50 rounded-lg">No hay datos disponibles</p>
      )}
      {projects.map(project => (
        <div key={project.projectId} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Project header */}
          <button
            onClick={() => toggleProject(project.projectId)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{expandedProjects.has(project.projectId) ? '▼' : '▶'}</span>
              <span className="text-sm font-bold text-slate-800">{project.projectName}</span>
              <span className="text-[10px] text-slate-400 font-medium">({project.groups.length} terceros)</span>
            </div>
            <span className="text-xs font-bold text-slate-700">{formatCurrency(mode === 'Presupuestado' ? project.totalPresupuestado : project.totalEjecutado)}</span>
          </button>

          {/* Tercero rows */}
          {expandedProjects.has(project.projectId) && (
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[9px] font-bold uppercase text-slate-400 bg-white">
                <div className="col-span-4">Tercero</div>
                <div className="col-span-2 text-center">Tipo</div>
                <div className="col-span-2 text-right">Presupuestado</div>
                <div className="col-span-2 text-right">Ejecutado</div>
                <div className="col-span-2 text-right">Diferencia</div>
              </div>
              {project.groups.map(group => (
                <button
                  key={group.entityId}
                  onClick={() => handleTerceroClick(project, group)}
                  className="w-full grid grid-cols-12 gap-2 px-4 py-3 hover:bg-indigo-50/50 transition-colors text-left items-center"
                >
                  <div className="col-span-4">
                    <p className="text-xs font-semibold text-slate-700 truncate">{group.entityName}</p>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <EntityTypeBadge entityType={group.entityType} />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-xs font-bold text-slate-700">{formatCurrency(group.totalPresupuestado)}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-xs font-bold text-slate-700">{formatCurrency(group.totalEjecutado)}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={clsx("text-xs font-black", group.diferencia === 0 ? "text-slate-400" : group.diferencia > 0 ? "text-emerald-600" : "text-rose-600")}>
                      {group.diferencia > 0 ? '+' : ''}{formatCurrency(group.diferencia)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ViewPanel({ recordDetail, companyId, onClose, onFormSubmit, onCellClick, projects, onNavigate, canGoBack, onBack }: {
  recordDetail: RecordDetail; companyId: string; onClose: () => void; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; onCellClick?: (data: SidepanelData) => void; projects?: Project[]; onNavigate: (screen: NavScreen) => void; canGoBack: boolean; onBack: () => void;
}) {
  const title = recordDetail.type === 'budget' ? 'Presupuesto' : recordDetail.type === 'ejecucion' ? 'Ejecución'
    : recordDetail.type === 'project' ? 'Proyecto' : recordDetail.type === 'client' ? 'Cliente'
    : recordDetail.type === 'provider' ? 'Proveedor' : recordDetail.type === 'tercero' ? 'Tercero' : '';
  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {recordDetail.type === 'budget' && <BudgetView budget={recordDetail.budget} ejecuciones={recordDetail.ejecuciones} companyId={companyId} onClose={onClose} onFormSubmit={onFormSubmit} onNavigate={onNavigate} />}
        {recordDetail.type === 'ejecucion' && <EjecucionView ejecucion={recordDetail.ejecucion} companyId={companyId} onClose={onClose} onNavigate={onNavigate} />}
        {recordDetail.type === 'project' && <ProjectView project={recordDetail.project} budgets={recordDetail.budgets} ejecuciones={recordDetail.ejecuciones} companyId={companyId} projects={projects} onFormSubmit={onFormSubmit} onNavigate={onNavigate} />}
        {recordDetail.type === 'client' && (<><DF label="Nombre" v={recordDetail.client.name} />
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Proyectos ({recordDetail.projects.length})</p>{recordDetail.projects.map(p => <div key={p.id} className="flex justify-between text-xs bg-slate-50 p-2 rounded mb-1"><span>{p.name}</span><span className="font-bold">{p.estado}</span></div>)}</div>
        </>)}
        {recordDetail.type === 'provider' && <DF label="Nombre" v={recordDetail.provider.name} />}
        {recordDetail.type === 'tercero' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Tercero</p>
              <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'tercero', record: recordDetail.tercero } })}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                <Save size={12} /> Editar
              </button>
            </div>
            <DF label="Nombre" v={recordDetail.tercero.name} />
            {recordDetail.tercero.apodo && <DF label="Apodo" v={recordDetail.tercero.apodo} />}
            {recordDetail.tercero.naturaleza && <DF label="Naturaleza" v={recordDetail.tercero.naturaleza} />}
            {recordDetail.tercero.documento && recordDetail.tercero.numeroDocumento && (
              <DF label="Documento" v={`${recordDetail.tercero.documento} ${recordDetail.tercero.numeroDocumento}`} />
            )}
            {recordDetail.tercero.lugar && <DF label="Lugar" v={recordDetail.tercero.lugar} />}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</p>
              <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                recordDetail.tercero.tipo === 'cliente' ? 'bg-blue-100 text-blue-700' :
                recordDetail.tercero.tipo === 'proveedor' ? 'bg-amber-100 text-amber-700' :
                'bg-purple-100 text-purple-700'
              )}>
                {recordDetail.tercero.tipo === 'cliente' ? 'Cliente' : recordDetail.tercero.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}
              </span>
            </div>
          </>
        )}
        {recordDetail.type === 'detalle-tercero' && (
          <TerceroGroupPanel projects={recordDetail.projects} onCellClick={onCellClick} mode={recordDetail.type === 'detalle-tercero' ? 'Presupuestado' : 'Presupuestado'} />
        )}
        {recordDetail.type === 'settings-editor' && (
          <SettingsEditor category={recordDetail.category} title={recordDetail.title} items={recordDetail.items}
            companyId={companyId} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function ProjectView({ project, budgets, ejecuciones, companyId, projects, onFormSubmit, onNavigate }: {
  project: Project; budgets: Budget[]; ejecuciones: Ejecucion[]; companyId: string; projects?: Project[]; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; onNavigate: (screen: NavScreen) => void;
}) {
  const [selectedState, setSelectedState] = useState(project.estado);
  const [saving, setSaving] = useState(false);
  const [settingsCat, setSettingsCat] = useState<SettingsCategorias | null>(null);
  const projectRef = useRef(project.id);

  useEffect(() => {
    const unsub = subscribeSettings(setSettingsCat);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (projectRef.current !== project.id) {
      projectRef.current = project.id;
      setSelectedState(project.estado);
    }
  }, [project.id, project.estado]);

  const isInferred = !(projects || []).some(p => p.name === project.name);

  const hasChanges = selectedState !== project.estado;

  const handleSaveState = async () => {
    if (isInferred || !project.id || !hasChanges) return;
    setSaving(true);
    await onFormSubmit(
      { mode: 'edit', type: 'project', record: project },
      { estado: selectedState },
    );
    setSaving(false);
  };

  const handleCreateProject = async () => {
    if (!project.name) return;
    await onFormSubmit(
      { mode: 'add', type: 'project' },
      { name: project.name, clientName: project.clientName || 'Sin cliente', clientId: '', estado: selectedState },
    );
  };

  const projectStates = (settingsCat?.stateProject || [])
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((s: any) => s.name);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Proyecto</p>
        {!isInferred && project.id && (
          <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'project', record: project } })}
            className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
            <Save size={12} /> Editar
          </button>
        )}
      </div>
      <DF label="Sigla" v={project.name} />
      {project.descripcion && <DF label="Nombre completo" v={project.descripcion} />}
      <DF label="Cliente" v={project.clientName || '—'} />
      {project.tipoProyectos && <DF label="Tipo de proyecto" v={project.tipoProyectos} />}
      {project.cantidad ? <DF label="Cantidad" v={String(project.cantidad) + (project.unidades ? ` ${project.unidades}` : '')} /> : null}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado</p>
        {isInferred ? (
          <div className="space-y-2">
            <select disabled value={selectedState} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed">
              {projectStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-[10px] text-amber-600 font-medium">Proyecto inferido — aún no tiene documento.</p>
            <button onClick={handleCreateProject} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg py-2 text-xs font-bold transition-colors">
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
              {projectStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {hasChanges && (
              <button onClick={handleSaveState} disabled={saving} aria-label="Guardar estado"
                className="px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm">
                <Save size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {project.soloEgresos && (
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200">Solo egresos</span>
        </div>
      )}
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Presupuestos ({budgets.length})</p>
        {budgets.length === 0 ? <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin presupuestos</p> : (() => {
          const groupedBudgets = budgets.reduce((acc, b) => {
            const key = b.entityId || b.entityName || 'Sin entidad';
            if (!acc[key]) acc[key] = { entityName: b.entityName || 'Sin entidad', entityType: b.entityType, items: [], total: 0 };
            acc[key].items.push(b);
            acc[key].total += b.montoPresupuestado;
            return acc;
          }, {} as Record<string, { entityName: string; entityType: string; items: Budget[]; total: number }>);
          const sortedGroups = Object.values(groupedBudgets).sort((a, b) => a.entityName.localeCompare(b.entityName));
          return sortedGroups.map(group => (
            <div key={group.entityName} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                  <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", group.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : group.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : group.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                    {group.entityType === 'ambos' ? 'C/P' : group.entityType === 'client' ? 'C' : group.entityType === 'provider' ? 'P' : '?'}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
              </div>
              <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                {group.items.map(b => (
                  <div key={b.id} className="flex justify-between text-xs px-2 py-1.5 hover:bg-slate-50">
                    <span className="text-slate-600 truncate mr-2">{b.descripcion}</span>
                    <span className="font-semibold text-slate-700 shrink-0">{formatCurrency(b.montoPresupuestado)}</span>
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
      <div className="border-t border-slate-100 pt-3 mt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ejecuciones ({ejecuciones.length})</p>
        {ejecuciones.length === 0 ? <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin ejecuciones</p> : (() => {
          const groupedEjs = ejecuciones.reduce((acc, e) => {
            const key = e.entityId || e.entityName || 'Sin entidad';
            if (!acc[key]) acc[key] = { entityName: e.entityName || 'Sin entidad', entityType: e.entityType, items: [], total: 0 };
            acc[key].items.push(e);
            acc[key].total += e.montoEjecutado;
            return acc;
          }, {} as Record<string, { entityName: string; entityType: string; items: Ejecucion[]; total: number }>);
          const sortedGroups = Object.values(groupedEjs).sort((a, b) => a.entityName.localeCompare(b.entityName));
          return sortedGroups.map(group => (
            <div key={group.entityName} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                  <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", group.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : group.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : group.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                    {group.entityType === 'ambos' ? 'C/P' : group.entityType === 'client' ? 'C' : group.entityType === 'provider' ? 'P' : '?'}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
              </div>
              <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                {group.items.map(e => (
                  <div key={e.id} className="flex justify-between text-xs px-2 py-1.5 hover:bg-slate-50">
                    <span className="text-slate-600 truncate mr-2">{e.fechaEjecutado} {e.descripcion ? `· ${e.descripcion}` : ''}</span>
                    <span className="font-semibold text-slate-700 shrink-0">{formatCurrency(e.montoEjecutado)}</span>
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
    </>
  );
}

function BudgetView({ budget, ejecuciones, companyId, onClose, onFormSubmit, onNavigate }: {
  budget: Budget; ejecuciones: Ejecucion[]; companyId: string; onClose: () => void; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; onNavigate: (screen: NavScreen) => void;
}) {
  const [addingEj, setAddingEj] = useState(false);
  const [ejForm, setEjForm] = useState({ descripcion: '', montoEjecutado: '', fechaEjecutado: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  const handleAddEj = async () => {
    setSaving(true);
    await onFormSubmit(
      { mode: 'add', type: 'ejecucion' },
      {
        descripcion: ejForm.descripcion || `Ejecución: ${budget.descripcion}`,
        projectId: budget.projectId || '',
        projectName: budget.projectName || '',
        entityId: budget.entityId || '',
        entityName: budget.entityName || '',
        entityType: budget.entityType || '',
        tipo: budget.tipo,
        montoEjecutado: Number(ejForm.montoEjecutado) || 0,
        fechaEjecutado: ejForm.fechaEjecutado,
        budgetId: budget.id,
      },
    );
    setSaving(false);
    setAddingEj(false);
  };

  return (
    <>
      <DF label="Descripción" v={budget.descripcion} />
      <DF label="Proyecto" v={budget.projectName} />
      <DF label="Cliente/Proveedor" v={budget.entityName} />
      <DF label="Tipo" v={budget.tipo} />
      <DF label="Monto Presupuestado" v={formatCurrency(budget.montoPresupuestado)} />
      <DF label="Mes" v={budget.mesPresupuestado} />
      <DF label="Estado" v={budget.estadoProyecto} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Ejecuciones ({ejecuciones.length})</p>
          <button onClick={() => setAddingEj(!addingEj)} className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">
            <Plus size={12} /> {addingEj ? 'Cancelar' : 'Agregar'}
          </button>
        </div>
        {ejecuciones.map((e) => (
          <div key={e.id} onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: e } })} className="flex justify-between text-xs bg-slate-50 hover:bg-indigo-50 p-2 rounded mb-1 cursor-pointer transition-colors">
            <span className="text-slate-600">{e.fechaEjecutado} - {e.descripcion}</span>
            <span className="font-bold text-slate-700">{formatCurrency(e.montoEjecutado)}</span>
          </div>
        ))}
        {ejecuciones.length === 0 && <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-lg">Sin ejecuciones</p>}
      </div>

      {addingEj && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Nueva ejecución vinculada</p>
          <FormInput label="Descripción" value={ejForm.descripcion} onChange={v => setEjForm(p => ({ ...p, descripcion: v }))} />
          <FormInput label="Monto" value={ejForm.montoEjecutado} onChange={v => setEjForm(p => ({ ...p, montoEjecutado: v }))} type="number" />
          <FormInput label="Fecha" value={ejForm.fechaEjecutado} onChange={v => setEjForm(p => ({ ...p, fechaEjecutado: v }))} type="date" />
          <button onClick={handleAddEj} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg py-2 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : 'Guardar Ejecución'}
          </button>
        </div>
      )}
    </>
  );
}

function ComprobantesViewer({ comprobantes, onDelete }: { comprobantes: Comprobante[]; onDelete?: (c: Comprobante) => void }) {
  const [modal, setModal] = useState<Comprobante | null>(null);

  if (!Array.isArray(comprobantes) || comprobantes.length === 0) return null;

  return (
    <>
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
        <Upload size={12} /> Comprobantes ({comprobantes.length})
      </p>
      <div className="space-y-2">
        {comprobantes.map(c => (
          <div key={c.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
            {c.type.startsWith('image/') ? (
              <img
                src={c.url}
                alt={c.name}
                className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                onClick={() => setModal(c)}
              />
            ) : (
              <button onClick={() => setModal(c)} className="shrink-0">
                <FileText size={22} className="text-slate-400 hover:text-indigo-600 transition-colors" />
              </button>
            )}
            <button className="flex-1 min-w-0 text-left" onClick={() => setModal(c)}>
              <p className="text-xs font-semibold text-slate-700 truncate">
                {c.descripcion || c.name}
                {c.tipo && <span className="ml-1.5 text-[9px] text-indigo-500 font-normal">({c.tipo})</span>}
              </p>
              <p className="text-[10px] text-slate-400">
                {c.type === 'application/pdf' ? 'PDF' : c.type === 'image/jpeg' ? 'JPG' : 'PNG'} &middot; {formatFileSize(c.size)}
                {c.uploadedAt && ` · ${new Date(c.uploadedAt).toLocaleDateString('es-CO')}`}
              </p>
            </button>
            <a href={c.url} target="_blank" rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0" title="Abrir en nueva pestaña">
              <Download size={16} />
            </a>
            {onDelete && (
              <button onClick={() => onDelete(c)}
                className="text-slate-300 hover:text-rose-500 transition-colors shrink-0" title="Eliminar comprobante">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal unificado para imágenes y PDFs */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 md:p-8" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{modal.descripcion || modal.name}</p>
                <p className="text-[10px] text-slate-400">
                  {modal.type === 'application/pdf' ? 'PDF' : modal.type === 'image/jpeg' ? 'JPG' : 'PNG'} &middot; {formatFileSize(modal.size)}
                  {modal.tipo && <span className="ml-2 text-indigo-500">({modal.tipo})</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a href={modal.url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all" title="Descargar">
                  <Download size={18} />
                </a>
                <button onClick={() => setModal(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100/50 flex items-center justify-center min-h-[300px]">
              {modal.type.startsWith('image/') ? (
                <img src={modal.url} alt={modal.name} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
              ) : (
                <iframe src={modal.url} className="w-full h-[70vh] rounded-lg" title={modal.name} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ComprobanteUploader({
  companyId,
  ejecucionId,
  comprobantes,
  onComprobantesChange,
  mode,
  pendingComprobantes,
  onPendingChange,
  tiposComprobante,
}: {
  companyId: string;
  ejecucionId?: string;
  comprobantes: Comprobante[];
  onComprobantesChange: (updated: Comprobante[]) => void;
  mode: 'add' | 'edit';
  pendingComprobantes?: PendingComprobante[];
  onPendingChange?: (updated: PendingComprobante[]) => void;
  tiposComprobante: SettingsItem[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newTipo, setNewTipo] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<PendingComprobante[]>([]);

  const addFilesToList = (files: FileList | null) => {
    if (!files) return;
    setValidationError('');
    const newItems: PendingComprobante[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateFile(file);
      if (!validation.valid) {
        setValidationError(prev => prev ? `${prev}; ${file.name}: ${validation.error}` : `${file.name}: ${validation.error}`);
        continue;
      }
      newItems.push({ id: crypto.randomUUID(), file, name: file.name, type: file.type, size: file.size, descripcion: newDesc, tipo: newTipo });
    }
    if (newItems.length > 0) {
      // If ADD mode, use pendingComprobantes. If EDIT, use selectedFiles (local queue)
      if (mode === 'add' && onPendingChange) {
        onPendingChange([...(pendingComprobantes || []), ...newItems]);
      } else {
        setSelectedFiles(prev => [...prev, ...newItems]);
      }
      setNewDesc('');
      setNewTipo('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadAll = async () => {
    if (!ejecucionId || selectedFiles.length === 0) {
      console.log('[COMPROBANTES] uploadAll skipped', { ejecucionId, files: selectedFiles.length });
      return;
    }
    console.log('[COMPROBANTES] uploadAll start', { ejecucionId, filesCount: selectedFiles.length, existingComprobantes: comprobantes.length });
    setUploading(true);
    setUploadProgress(0);
    let uploaded = 0;
    const total = selectedFiles.length;
    const newComprobantes: Comprobante[] = [];

    for (const pf of selectedFiles) {
      try {
        const path = generateFilePath(companyId, ejecucionId, pf.name);
        console.log('[COMPROBANTES] uploading file', { name: pf.name, path });
        const result = await uploadFile(pf.file, path, (p) => setUploadProgress(((uploaded + p / 100) / total) * 100));
        console.log('[COMPROBANTES] upload success', { name: pf.name, url: result.url });
        newComprobantes.push({
          id: crypto.randomUUID(),
          name: pf.name,
          url: result.url,
          path: result.path,
          type: pf.type,
          size: pf.size,
          uploadedAt: new Date().toISOString(),
          ...(pf.descripcion ? { descripcion: pf.descripcion } : {}),
          ...(pf.tipo ? { tipo: pf.tipo } : {}),
        });
        uploaded++;
        setUploadProgress((uploaded / total) * 100);
      } catch (err) {
        console.error(`[COMPROBANTES] Upload failed for ${pf.name}:`, err);
        setValidationError(prev => prev ? `${prev}; Error en ${pf.name}` : `Error en ${pf.name}`);
      }
    }

    if (newComprobantes.length > 0) {
      const updated = [...comprobantes, ...newComprobantes];
      console.log('[COMPROBANTES] updating firestore', { ejecucionId, totalComprobantes: updated.length, newComprobantes: newComprobantes.length });
      onComprobantesChange(updated);
      try {
        await updateEjecucion(companyId, ejecucionId, { comprobantes: JSON.parse(JSON.stringify(updated)) });
        console.log('[COMPROBANTES] firestore update success');
      } catch (err) {
        console.error('[COMPROBANTES] firestore update failed:', err);
      }
    }
    setSelectedFiles([]);
    setUploading(false);
    setUploadProgress(0);
  };

  const removeSelected = (id: string) => {
    if (mode === 'add' && onPendingChange) {
      onPendingChange((pendingComprobantes || []).filter(p => p.id !== id));
    } else {
      setSelectedFiles(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleRemove = async (comp: Comprobante) => {
    try {
      if (ejecucionId && comp.path) {
        await deleteFile(comp.path);
      }
      const updated = comprobantes.filter(c => c.id !== comp.id);
      onComprobantesChange(updated);
      if (ejecucionId) {
        await updateEjecucion(companyId, ejecucionId, { comprobantes: JSON.parse(JSON.stringify(updated)) });
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const pendingList = mode === 'add' ? (pendingComprobantes || []) : selectedFiles;

  return (
    <div className="space-y-2">
      {/* Descripción + Tipo */}
      <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
        placeholder="Descripción del comprobante"
        className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
      {tiposComprobante.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {tiposComprobante.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(t => (
            <button key={t.name} type="button" onClick={() => setNewTipo(newTipo === t.name ? '' : t.name)}
              className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                newTipo === t.name ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* File picker */}
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple
        onChange={e => { addFilesToList(e.target.files); }} className="hidden" />
      <div className="flex gap-2">
        <button onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors">
          <Upload size={14} /> Seleccionar archivos
        </button>
        {pendingList.length > 0 && mode === 'edit' && (
          <button onClick={uploadAll} disabled={uploading}
            className="flex items-center justify-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 px-4 py-2 rounded-lg transition-colors">
            {uploading ? `${Math.round(uploadProgress)}%` : `Subir (${pendingList.length})`}
          </button>
        )}
      </div>

      {validationError && (
        <p className="text-[10px] text-rose-600 font-medium">{validationError}</p>
      )}

      {uploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Subiendo archivos...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Existing comprobantes (siempre visibles) */}
      {comprobantes.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase">{comprobantes.length} comprobante(s) guardado(s)</p>
          {comprobantes.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2 border border-emerald-200">
              {c.type.startsWith('image/') ? (
                <img src={c.url} alt={c.name} className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <FileText size={16} className="text-emerald-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-emerald-800 truncate">{c.descripcion || c.name}</p>
                <p className="text-[9px] text-emerald-600">{formatFileSize(c.size)}{c.tipo && <span className="ml-1.5 text-emerald-700 font-medium">({c.tipo})</span>}</p>
              </div>
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                className="text-emerald-400 hover:text-indigo-600 shrink-0" title="Descargar">
                <Download size={12} />
              </a>
              {mode === 'edit' && (
                <button onClick={() => handleRemove(c)} className="text-emerald-400 hover:text-rose-500 shrink-0" title="Eliminar">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending / selected files list */}
      {pendingList.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-amber-500 uppercase">{pendingList.length} pendiente(s)</p>
          {pendingList.map(pc => (
            <div key={pc.id} className="flex items-center gap-2 bg-amber-50 rounded-lg p-2 border border-amber-200">
              <FileText size={16} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-amber-800 truncate">{pc.name}</p>
                <p className="text-[9px] text-amber-600">{formatFileSize(pc.size)}{pc.tipo ? <span className="ml-1.5 text-amber-700 font-medium">({pc.tipo})</span> : ''}</p>
              </div>
              <button onClick={() => removeSelected(pc.id)}
                className="text-amber-400 hover:text-rose-500 shrink-0" title="Quitar">
                <X size={12} />
              </button>
            </div>
          ))}
          {mode === 'add' && (
            <p className="text-[9px] text-amber-500 italic">Se subirán al guardar la ejecución</p>
          )}
        </div>
      )}

      {/* Submit button for ADD mode pending comprobantes is part of form submit */}
    </div>
  );
}

function EjecucionView({ ejecucion, companyId, onNavigate }: { ejecucion: Ejecucion; companyId: string; onClose: () => void; onNavigate: (screen: NavScreen) => void }) {
  console.log('[COMPROBANTES] EjecucionView render', { ejecucionId: ejecucion.id, comprobantes: ejecucion.comprobantes?.length });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState('');
  const [comprobantes, setComprobantes] = useState<Comprobante[]>(() => ejecucion.comprobantes || []);

  useEffect(() => {
    const unsub = subscribeBudgets(companyId, setBudgets);
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    setComprobantes(ejecucion.comprobantes || []);
  }, [ejecucion.comprobantes]);

  const filtered = search ? budgets.filter(b => b.descripcion.toLowerCase().includes(search.toLowerCase()) || b.projectName.toLowerCase().includes(search.toLowerCase())) : budgets;
  const linkedBudget = budgets.find(b => b.id === ejecucion.budgetId);

  const handleLink = async (budgetId: string) => {
    await updateEjecucion(companyId, ejecucion.id, { budgetId });
  };
  const handleUnlink = async () => {
    await updateEjecucion(companyId, ejecucion.id, { budgetId: '' });
  };

  const handleDeleteComprobante = async (comp: Comprobante) => {
    try {
      if (comp.path) await deleteFile(comp.path);
      const updated = comprobantes.filter(c => c.id !== comp.id);
      setComprobantes(updated);
      await updateEjecucion(companyId, ejecucion.id, { comprobantes: JSON.parse(JSON.stringify(updated)) });
    } catch (err) {
      console.error('Error deleting comprobante:', err);
    }
  };

  return (
    <>
      <DF label="Descripción" v={ejecucion.descripcion} />
      <DF label="Proyecto" v={ejecucion.projectName} />
      <DF label="Cliente/Proveedor" v={ejecucion.entityName} />
      <DF label="Tipo" v={ejecucion.tipo} />
      <DF label="Monto" v={formatCurrency(ejecucion.montoEjecutado)} />
      <DF label="Fecha" v={ejecucion.fechaEjecutado} />

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
          <Link2 size={12} /> Presupuesto vinculado
        </p>
        {linkedBudget ? (
          <div onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: linkedBudget, ejecuciones: [] } })} className="flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 rounded-lg p-3 cursor-pointer transition-colors">
            <div>
              <p className="text-xs font-semibold text-indigo-700">{linkedBudget.descripcion}</p>
              <p className="text-[10px] text-indigo-500">{linkedBudget.projectName} • {formatCurrency(linkedBudget.montoPresupuestado)}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleUnlink(); }} className="text-slate-400 hover:text-rose-500 transition-colors" title="Desvincular">
              <Unlink size={14} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic mb-3">Sin presupuesto vinculado</p>
        )}

        {!linkedBudget && (
          <>
            <button onClick={() => setLinking(!linking)} className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 mt-2 transition-colors">
              <Search size={12} /> {linking ? 'Cerrar' : 'Buscar presupuesto'}
            </button>
            {linking && (
              <div className="mt-3">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por descripción o proyecto..." autoFocus
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all mb-2" />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">Sin resultados</p>
                  ) : filtered.map(b => (
                    <button key={b.id} onClick={() => { handleLink(b.id); setLinking(false); setSearch(''); }}
                      className={clsx("w-full text-left p-2 rounded-lg text-xs transition-colors hover:bg-indigo-50", b.id === ejecucion.budgetId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700')}>
                      <span className="font-medium">{b.descripcion}</span>
                      <span className="text-slate-400 ml-2">{b.projectName} • {formatCurrency(b.montoPresupuestado)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {comprobantes.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <ComprobantesViewer comprobantes={comprobantes} onDelete={handleDeleteComprobante} />
        </div>
      )}
    </>
  );
}

function SettingsEditor({ category, title, items, companyId, onClose }: {
  category: string; title: string; items: any[]; companyId: string; onClose: () => void;
}) {
  const [localItems, setLocalItems] = useState([...items]);
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    setLocalItems(prev => [...prev, { name: '', color: '#6366f1', order: prev.length }]);
  };

  const handleUpdate = (index: number, field: string, value: any) => {
    setLocalItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleDelete = (index: number) => {
    setLocalItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    setLocalItems(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, i) => ({ ...item, order: i }));
    });
  };

  const handleSave = async () => {
    if (localItems.some((i: any) => !i.name.trim())) return;
    setSaving(true);
    const updatePayload = { [category]: localItems.map((item: any, i: number) => ({ ...item, order: i })) };
    await updateSettings(updatePayload);
    setSaving(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={false} onBack={() => {}} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {localItems.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => handleMove(index, 'up')} disabled={index === 0}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
              <button onClick={() => handleMove(index, 'down')} disabled={index === localItems.length - 1}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
            </div>
            <input type="color" value={item.color} onChange={e => handleUpdate(index, 'color', e.target.value)}
              className="w-8 h-8 rounded border border-slate-300 cursor-pointer shrink-0" />
            <input type="text" value={item.name} onChange={e => handleUpdate(index, 'name', e.target.value)}
              placeholder="Nombre..." className="flex-1 border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none" />
            <button onClick={() => handleDelete(index)}
              className="text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
        <button onClick={handleAdd}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-3 rounded-lg transition-colors">
          <Plus size={14} /> Agregar
        </button>
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSave} disabled={saving || localItems.some((i: any) => !i.name.trim())}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2">
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function Calculator({ value, onChange, onResult }: { value: string; onChange: (v: string) => void; onResult: (res: number) => void }) {
  const append = (ch: string) => onChange(value + ch);
  const clear = () => onChange('');
  const backspace = () => onChange(value.slice(0, -1));
  const evaluate = () => {
    try {
      const sanitized = value.replace(/[^0-9+\-*/.()]/g, '');
      if (!sanitized) return;
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === 'number' && isFinite(result)) onResult(result);
    } catch { /* ignore */ }
  };

  // Keyboard support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key;
    if (key === 'Enter') { e.preventDefault(); evaluate(); }
    else if (key === 'Escape') { e.preventDefault(); onResult(parseFloat(value) || 0); }
    else if (key === 'Backspace') { e.preventDefault(); backspace(); }
    else if (key === 'Delete') { e.preventDefault(); clear(); }
    else if (/^[0-9+\-*/.()]$/.test(key)) { e.preventDefault(); append(key); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); evaluate(); }
      else if (e.key === 'Escape') { e.preventDefault(); onResult(parseFloat(value) || 0); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      else if (e.key === 'Delete') { e.preventDefault(); clear(); }
      else if (/^[0-9+\-*/.()]$/.test(e.key)) { e.preventDefault(); append(e.key); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [value]);

  const btnClass = "p-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors text-center select-none cursor-pointer";
  const opClass = "p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 transition-colors text-center select-none cursor-pointer";
  return (
    <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3 shadow-sm" onKeyDown={handleKeyDown}>
      <div className="bg-slate-50 rounded-lg p-2 mb-2 text-right text-sm font-mono font-bold text-slate-800 min-h-[32px] truncate border border-slate-100">
        {value || <span className="text-slate-400 font-normal">0</span>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" onClick={clear} className="p-2 text-xs font-bold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors">C</button>
        <button type="button" onClick={backspace} className={opClass}>⌫</button>
        <button type="button" onClick={() => append('/')} className={opClass}>÷</button>
        <button type="button" onClick={() => append('*')} className={opClass}>×</button>
        <button type="button" onClick={() => append('7')} className={btnClass}>7</button>
        <button type="button" onClick={() => append('8')} className={btnClass}>8</button>
        <button type="button" onClick={() => append('9')} className={btnClass}>9</button>
        <button type="button" onClick={() => append('-')} className={opClass}>−</button>
        <button type="button" onClick={() => append('4')} className={btnClass}>4</button>
        <button type="button" onClick={() => append('5')} className={btnClass}>5</button>
        <button type="button" onClick={() => append('6')} className={btnClass}>6</button>
        <button type="button" onClick={() => append('+')} className={opClass}>+</button>
        <button type="button" onClick={() => append('1')} className={btnClass}>1</button>
        <button type="button" onClick={() => append('2')} className={btnClass}>2</button>
        <button type="button" onClick={() => append('3')} className={btnClass}>3</button>
        <button type="button" onClick={evaluate} className="p-2 text-xs font-bold rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors row-span-2">=</button>
        <button type="button" onClick={() => append('0')} className={`${btnClass} col-span-2`}>0</button>
        <button type="button" onClick={() => append('.')} className={btnClass}>.</button>
      </div>
      <button type="button" onClick={() => { const r = parseFloat(value); if (!isNaN(r)) onResult(r); }}
        className="w-full mt-2 p-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
        Usar resultado
      </button>
    </div>
  );
}

function DF({ label, v }: { label: string; v: string }) { return <div><p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p><p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p></div>; }

function DataPanel({ data, companyId, onClose, onNavigate, projects, canGoBack, onBack }: { data: SidepanelData; companyId: string; onClose: () => void; onNavigate: (screen: NavScreen) => void; projects?: Project[]; canGoBack: boolean; onBack: () => void }) {
  const [expandedEj, setExpandedEj] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{ type: 'budget' | 'ejecucion'; id: string } | null>(null);

  const handleArchive = async (type: 'budget' | 'ejecucion', id: string) => {
    try {
      if (type === 'budget') {
        await updateBudget(companyId, id, { archivado: true });
      } else {
        await updateEjecucion(companyId, id, { archivado: true });
      }
    } catch (err) {
      console.error('Archive failed:', err);
    }
    setArchiveConfirm(null);
  };
  // Parse title "Proyecto / Mes" for cell-level data
  const titleParts = data.title?.split(' / ') || [];
  const cellProjectName = titleParts.length === 2 ? titleParts[0] : '';
  const cellMonth = titleParts.length === 2 ? titleParts[1] : '';
  const cellProject = projects?.find(p => p.name === cellProjectName || p.id === cellProjectName);

  const handleAddFromCell = (formType: 'budget' | 'ejecucion') => {
    if (!cellProjectName || !cellMonth) return;
    const monthIndex = MONTHS.indexOf(cellMonth as Month);
    if (monthIndex < 0) return;
    const currentYear = new Date().getFullYear();
    const defaults: Record<string, string> = {
      projectName: cellProjectName,
      tipo: data.tipo,
    };
    if (cellProject) defaults.projectId = cellProject.id;
    if (cellProject?.clientName) {
      defaults.entityName = cellProject.clientName;
      defaults.entityType = 'client';
    }
    if (formType === 'budget') {
      defaults.mesPresupuestado = cellMonth;
      defaults.fechaEjecutado = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    } else {
      defaults.fechaEjecutado = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-15`;
    }
    onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: formType, defaults } });
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader
        title={`Detalle de ${data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ${data.mode === 'Presupuestado' ? 'Presupuestado' : 'Ejecutado'}`}
        canGoBack={canGoBack}
        onBack={onBack}
        onClose={onClose}
      />
      <div className="px-5 py-3">
        <div className={clsx("rounded-xl p-4 border", data.mode === 'Presupuestado' ? "bg-sky-50 border-sky-100 text-sky-900" : "bg-slate-800 border-slate-700 text-white")}>
          <p className={clsx("text-[10px] font-bold uppercase tracking-widest", data.mode === 'Presupuestado' ? "text-sky-600" : "text-slate-400")}>Seleccionado</p>
          <p className="text-sm font-bold mt-1">{data.title}</p>
          <p className="text-xs mt-1 opacity-80">{data.subtitle}</p>
        </div>
        {cellProjectName && cellMonth && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => handleAddFromCell('budget')}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors">
              <Plus size={13} /> {data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} Presupuestado
            </button>
            <button onClick={() => handleAddFromCell('ejecucion')}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors">
              <Plus size={13} /> {data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} Ejecutado
            </button>
          </div>
        )}
      </div>

      {/* BODY — scrollable, cambia según modo */}
      <div className="flex-1 overflow-y-auto p-6">
        {data.mode === 'Presupuestado' && (
          <div className="mb-6"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Presupuestos ({data.budgets.length})</p>
          {(() => {
            const grouped = data.budgets.reduce((acc, b) => {
              const key = b.entityId || b.entityName || 'Sin entidad';
              if (!acc[key]) acc[key] = { entityName: b.entityName || 'Sin entidad', entityType: b.entityType, items: [], total: 0 };
              acc[key].items.push(b);
              acc[key].total += b.montoPresupuestado;
              return acc;
            }, {} as Record<string, { entityName: string; entityType: string; items: Budget[]; total: number }>);
            const sorted = Object.values(grouped).sort((a, b) => a.entityName.localeCompare(b.entityName));
            return sorted.map(group => (
              <div key={group.entityName} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                    <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", group.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : group.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : group.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                      {group.entityType === 'ambos' ? 'C/P' : group.entityType === 'client' ? 'C' : group.entityType === 'provider' ? 'P' : '?'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
                </div>
                <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                  {group.items.map(b => {
                    const ejbs = data.ejecuciones.filter(e => e.budgetId === b.id);
                    return (
                    <div key={b.id} className="px-2 py-1.5">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-slate-700 truncate">{b.descripcion}</p>
                          <p className="text-[10px] text-slate-400">{b.mesPresupuestado}</p>
                        </div>
                        <p className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(b.montoPresupuestado)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'budget', budget: b, ejecuciones: ejbs } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                          <FileText size={11} /> Ver
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'budget', record: b } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                          <Save size={11} /> Editar
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'add', type: 'ejecucion', defaults: {
                          projectId: b.projectId || '',
                          projectName: b.projectName || '',
                          entityId: b.entityId || '',
                          entityName: b.entityName || '',
                          entityType: b.entityType || 'client',
                          tipo: b.tipo,
                          budgetId: b.id,
                        } } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">
                          <Plus size={11} /> Ejecutar
                        </button>
                        {archiveConfirm?.id === b.id && archiveConfirm?.type === 'budget' ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleArchive('budget', b.id)}
                              className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded transition-colors">
                              Confirmar
                            </button>
                            <button onClick={() => setArchiveConfirm(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setArchiveConfirm({ type: 'budget', id: b.id })}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded transition-colors">
                            <Trash2 size={11} /> Archivar
                          </button>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ));
          })()}</div>
        )}

        {data.mode === 'Ejecutado' && (
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ejecuciones ({data.ejecuciones.length})</p>
          {(() => {
            const grouped = data.ejecuciones.reduce((acc, e) => {
              const key = e.entityId || e.entityName || 'Sin entidad';
              if (!acc[key]) acc[key] = { entityName: e.entityName || 'Sin entidad', entityType: e.entityType, items: [], total: 0 };
              acc[key].items.push(e);
              acc[key].total += e.montoEjecutado;
              return acc;
            }, {} as Record<string, { entityName: string; entityType: string; items: Ejecucion[]; total: number }>);
            const sorted = Object.values(grouped).sort((a, b) => a.entityName.localeCompare(b.entityName));
            return sorted.map(group => (
              <div key={group.entityName} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-100 rounded-t-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{group.entityName}</span>
                    <span className={clsx("px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase", group.entityType === 'client' ? 'bg-emerald-100 text-emerald-700' : group.entityType === 'provider' ? 'bg-amber-100 text-amber-700' : group.entityType === 'ambos' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500')}>
                      {group.entityType === 'ambos' ? 'C/P' : group.entityType === 'client' ? 'C' : group.entityType === 'provider' ? 'P' : '?'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">{formatCurrency(group.total)}</span>
                </div>
                <div className="border border-slate-100 rounded-b-lg divide-y divide-slate-50">
                  {group.items.map(e => {
                    const cCount = e.comprobantes?.length || 0;
                    if (e.id === 'ncoAgRDxY7Tx1ftrvpv0' || cCount > 0) console.log('[COMPROBANTES] DataPanel item', { id: e.id, desc: e.descripcion, cCount, comprobantes: e.comprobantes?.length });
                    return (
                    <div key={e.id} className="px-2 py-1.5">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-slate-700 truncate">{e.descripcion}</p>
                          <p className="text-[10px] text-slate-400">{e.fechaEjecutado}</p>
                        </div>
                        <p className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(e.montoEjecutado)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'view', detail: { type: 'ejecucion', ejecucion: e } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                          <FileText size={11} /> Ver
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'ejecucion', record: e } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                          <Save size={11} /> Editar
                        </button>
                        <button onClick={() => onNavigate({ id: crypto.randomUUID(), type: 'form', form: { mode: 'edit', type: 'ejecucion', record: e } })}
                          className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded transition-colors">
                          <Paperclip size={11} /> {cCount > 0 ? `Comprobantes (${cCount})` : 'Agregar comprobante'}
                        </button>
                        {archiveConfirm?.id === e.id && archiveConfirm?.type === 'ejecucion' ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleArchive('ejecucion', e.id)}
                              className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded transition-colors">
                              Confirmar
                            </button>
                            <button onClick={() => setArchiveConfirm(null)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-1">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setArchiveConfirm({ type: 'ejecucion', id: e.id })}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded transition-colors">
                            <Trash2 size={11} /> Archivar
                          </button>
                        )}
                      </div>
                      {/* Siempre mostrar comprobantes si existen */}
                      {cCount > 0 && (
                        <div className="mt-2">
                          <ComprobantesViewer comprobantes={e.comprobantes} onDelete={async (comp) => {
                            try {
                              if (comp.path) await deleteFile(comp.path);
                              const updated = e.comprobantes.filter((c: any) => c.id !== comp.id);
                              await updateEjecucion(companyId, e.id, { comprobantes: JSON.parse(JSON.stringify(updated)) });
                            } catch (err) { console.error('Error deleting comprobante:', err); }
                          }} />
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            ));
          })()}</div>
        )}
      </div>

      {/* FOOTER — siempre visible abajo */}
      <div className="shrink-0 p-6 border-t border-slate-100 bg-white">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
          <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase font-semibold">Presupuestado</span><span className="text-slate-700 font-bold">{formatCurrency(data.presupuestado)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase font-semibold">Ejecutado</span><span className="text-slate-700 font-bold">{formatCurrency(data.ejecutado)}</span></div>
          <div className="h-px bg-slate-200 w-full my-1" />
          <div className="flex justify-between text-sm font-bold">
            <span className="text-slate-700 uppercase text-[10px] tracking-wider">Diferencia</span>
            <span className={clsx("font-black text-lg", data.diferencia === 0 ? "text-slate-400" : (data.diferencia > 0 ? "text-emerald-600" : "text-rose-600"))}>{data.diferencia > 0 ? '+' : ''}{formatCurrency(data.diferencia)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
