'use client'

import { useState, useEffect } from 'react';
import { SidepanelData, Budget, Ejecucion, RecordDetail, ActiveForm, MONTHS, Project, Client } from '@/lib/types';
import { subscribeClients, subscribeProviders, subscribeBudgets, updateEjecucion, addEjecucion, addClient, addProject } from '@/lib/firestore';
import { X, FileText, Bell, Settings, Filter, ChevronDown, Plus, Search, Link2, Unlink } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface SidepanelProps {
  data: SidepanelData | null;
  recordDetail: RecordDetail | null;
  activeForm: ActiveForm | null;
  companyId: string;
  onClose: () => void;
  onFormSubmit: (form: ActiveForm, data: Record<string, any>) => Promise<void>;
  projects?: Project[];
}

export function Sidepanel({ data, recordDetail, activeForm, companyId, onClose, onFormSubmit, projects }: SidepanelProps) {
  const visible = data || recordDetail || activeForm;

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
        <FormPanel form={activeForm} companyId={companyId} onClose={onClose} onSubmit={onFormSubmit} projects={projects} />
      ) : recordDetail ? (
        <ViewPanel recordDetail={recordDetail} companyId={companyId} onClose={onClose} onFormSubmit={onFormSubmit} projects={projects} />
      ) : data ? (
        <DataPanel data={data} onClose={onClose} />
      ) : null}
    </aside>
  );
}

function FormPanel({ form, companyId, onClose, onSubmit, projects }: { form: ActiveForm; companyId: string; onClose: () => void; onSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; projects?: Project[] }) {
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');

  const safeProjects = projects || [];

  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  useEffect(() => {
    const unsubs = [subscribeClients(setClients), subscribeProviders(setProviders), subscribeBudgets(companyId, setAllBudgets)];
    return () => unsubs.forEach(u => u());
  }, [companyId]);

  const clientsAndProviders = [...clients.map(c => ({ value: c.name, label: c.name, type: 'client' })), ...providers.map(p => ({ value: p.name, label: p.name, type: 'provider' }))];

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    await addClient({ name: newClientName.trim() });
    set('clienteOProveedor', newClientName.trim());
    setNewClientName('');
    setShowNewClient(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await addProject(companyId, { name: newProjectName.trim(), clientName: newProjectClient.trim() || 'Sin cliente', clientId: '', estado: 'Activo' });
    set('proyectoAsignado', newProjectName.trim());
    setNewProjectName('');
    setNewProjectClient('');
    setShowNewProject(false);
  };

  useEffect(() => {
    if (form.mode === 'edit') {
      const init: Record<string, string> = {};
      const r = form.record as any;
      Object.keys(r).forEach(k => { if (k !== 'id') init[k] = String(r[k] ?? ''); });
      setFields(init);
    } else {
      const init: Record<string, string> = form.type === 'ejecucion'
        ? { tipo: 'ingreso', fechaEjecutado: new Date().toISOString().split('T')[0] }
        : { tipo: 'ingreso' };
      if (form.defaults) Object.assign(init, form.defaults);
      setFields(init);
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
    const data: Record<string, any> = { ...fields };
    if (ft === 'budget') { data.montoPresupuestado = Number(data.montoPresupuestado) || 0; delete data.fechaEjecutado; }
    if (ft === 'ejecucion') data.montoEjecutado = Number(data.montoEjecutado) || 0;
    await onSubmit(form, data);
    setSaving(false);
  };

  const filteredBudgets = allBudgets.filter(b => {
    const proj = f('proyectoAsignado');
    const cli = f('clienteOProveedor');
    if (proj && cli) return b.proyectoAsignado === proj || b.clienteOProveedor === cli;
    if (proj) return b.proyectoAsignado === proj;
    if (cli) return b.clienteOProveedor === cli;
    return true;
  });

  const title = `${form.mode === 'add' ? 'Nuevo' : 'Editar'} ${ft === 'budget' ? 'Presupuesto' : ft === 'ejecucion' ? 'Ejecución' : ft === 'project' ? 'Proyecto' : ft === 'client' ? 'Cliente' : 'Proveedor'}`;

  if (ft === 'project' || ft === 'client' || ft === 'provider') {
    return <SimpleForm title={title} fields={ft === 'project' ? ['name', 'clientName'] : ['name']}
      labels={{ name: 'Nombre', clientName: 'Cliente' }} f={f} set={set} form={form} onClose={onClose} onSubmit={handleSubmit} saving={saving} />;
  }

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <TipoSwitch value={f('tipo')} onChange={v => set('tipo', v)} />
        <SearchableSelect label="Proyecto" value={f('proyectoAsignado')} onChange={v => set('proyectoAsignado', v)} options={safeProjects.map(p => ({ value: p.name, label: p.name }))} placeholder="Buscar proyecto..." />
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
        <SearchableSelect label="Cliente / Proveedor" value={f('clienteOProveedor')} onChange={v => set('clienteOProveedor', v)} options={clientsAndProviders} placeholder="Buscar cliente o proveedor..." />
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
        <FormInput label={ft === 'budget' ? 'Monto Presupuestado' : 'Monto Ejecutado'} value={f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado')} onChange={v => set(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado', v)} type="number" />
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
                set('proyectoAsignado', b.proyectoAsignado);
                set('clienteOProveedor', b.clienteOProveedor);
                set('tipo', b.tipo);
              }
            }} options={filteredBudgets.map(b => ({ value: b.id, label: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.proyectoAsignado}` }))} placeholder="Buscar presupuesto..." />
          </>
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

function SimpleForm({ title, fields, labels, f, set, form, onClose, onSubmit, saving }: {
  title: string; fields: string[]; labels: Record<string, string>;
  f: (k: string) => string; set: (k: string, v: string) => void;
  form: ActiveForm; onClose: () => void; onSubmit: () => Promise<void>; saving: boolean;
}) {
  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {fields.map(k => (
          <div key={k}><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{labels[k] || k}</label><input type="text" value={f(k)} onChange={e => set(k, e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" /></div>
        ))}
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={onSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

function ViewPanel({ recordDetail, companyId, onClose, onFormSubmit, projects }: {
  recordDetail: RecordDetail; companyId: string; onClose: () => void; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>; projects?: Project[];
}) {
  const title = recordDetail.type === 'budget' ? 'Presupuesto' : recordDetail.type === 'ejecucion' ? 'Ejecución'
    : recordDetail.type === 'project' ? 'Proyecto' : recordDetail.type === 'client' ? 'Cliente' : 'Proveedor';
  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {recordDetail.type === 'budget' && <BudgetView budget={recordDetail.budget} ejecuciones={recordDetail.ejecuciones} companyId={companyId} onClose={onClose} onFormSubmit={onFormSubmit} />}
        {recordDetail.type === 'ejecucion' && <EjecucionView ejecucion={recordDetail.ejecucion} companyId={companyId} onClose={onClose} />}
        {recordDetail.type === 'project' && <ProjectView project={recordDetail.project} budgets={recordDetail.budgets} ejecuciones={recordDetail.ejecuciones} companyId={companyId} projects={projects} onFormSubmit={onFormSubmit} />}
        {recordDetail.type === 'client' && (<><DF label="Nombre" v={recordDetail.client.name} />
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Proyectos ({recordDetail.projects.length})</p>{recordDetail.projects.map(p => <div key={p.id} className="flex justify-between text-xs bg-slate-50 p-2 rounded mb-1"><span>{p.name}</span><span className="font-bold">{p.estado}</span></div>)}</div>
        </>)}
        {recordDetail.type === 'provider' && <DF label="Nombre" v={recordDetail.provider.name} />}
      </div>
    </div>
  );
}

function ProjectView({ project, budgets, ejecuciones, companyId, projects, onFormSubmit }: {
  project: Project; budgets: Budget[]; ejecuciones: Ejecucion[]; companyId: string; projects?: Project[]; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>;
}) {
  const [selectedState, setSelectedState] = useState(project.estado);
  const [saving, setSaving] = useState(false);

  const isInferred = !(projects || []).some(p => p.name === project.name);

  const handleStateChange = async (newState: string) => {
    if (isInferred || !project.id) return;
    setSelectedState(newState);
    setSaving(true);
    await onFormSubmit(
      { mode: 'edit', type: 'project', record: project },
      { estado: newState },
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

  const projectStates = ['Activo', 'Cerrado', 'Negociación', 'En ejecución', 'Cancelado'];

  return (
    <>
      <DF label="Nombre" v={project.name} />
      <DF label="Cliente" v={project.clientName} />
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
          <select value={selectedState} onChange={e => handleStateChange(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white">
            {projectStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Presupuestos ({budgets.length})</p>{budgets.map(b => <div key={b.id} className="flex justify-between text-xs bg-slate-50 p-2 rounded mb-1"><span>{b.descripcion}</span><span className="font-bold">{formatCurrency(b.montoPresupuestado)}</span></div>)}</div>
      <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ejecuciones ({ejecuciones.length})</p>{ejecuciones.map(e => <div key={e.id} className="flex justify-between text-xs bg-slate-50 p-2 rounded mb-1"><span>{e.fechaEjecutado}</span><span className="font-bold">{formatCurrency(e.montoEjecutado)}</span></div>)}</div>
    </>
  );
}

function BudgetView({ budget, ejecuciones, companyId, onClose, onFormSubmit }: {
  budget: Budget; ejecuciones: Ejecucion[]; companyId: string; onClose: () => void; onFormSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>;
}) {
  const [addingEj, setAddingEj] = useState(false);
  const [ejForm, setEjForm] = useState({ descripcion: '', montoEjecutado: '', fechaEjecutado: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [viewEj, setViewEj] = useState<Ejecucion | null>(null);

  const handleAddEj = async () => {
    setSaving(true);
    await onFormSubmit(
      { mode: 'add', type: 'ejecucion' },
      {
        descripcion: ejForm.descripcion || `Ejecución: ${budget.descripcion}`,
        proyectoAsignado: budget.proyectoAsignado,
        clienteOProveedor: budget.clienteOProveedor,
        tipo: budget.tipo,
        montoEjecutado: Number(ejForm.montoEjecutado) || 0,
        fechaEjecutado: ejForm.fechaEjecutado,
        budgetId: budget.id,
      },
    );
    setSaving(false);
    setAddingEj(false);
  };

  if (viewEj) {
    return (
      <>
        <button onClick={() => setViewEj(null)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-1">← Volver al presupuesto</button>
        <MiniEjecucionView ejecucion={viewEj} companyId={companyId} />
      </>
    );
  }

  return (
    <>
      <DF label="Descripción" v={budget.descripcion} />
      <DF label="Proyecto" v={budget.proyectoAsignado} />
      <DF label="Cliente/Proveedor" v={budget.clienteOProveedor} />
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
          <div key={e.id} onClick={() => setViewEj(e)} className="flex justify-between text-xs bg-slate-50 hover:bg-indigo-50 p-2 rounded mb-1 cursor-pointer transition-colors">
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

function MiniEjecucionView({ ejecucion, companyId }: { ejecucion: Ejecucion; companyId: string }) {
  return (
    <>
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Detalle de Ejecución</p>
      <DF label="Descripción" v={ejecucion.descripcion} />
      <DF label="Proyecto" v={ejecucion.proyectoAsignado} />
      <DF label="Cliente/Proveedor" v={ejecucion.clienteOProveedor} />
      <DF label="Tipo" v={ejecucion.tipo} />
      <DF label="Monto" v={formatCurrency(ejecucion.montoEjecutado)} />
      <DF label="Fecha" v={ejecucion.fechaEjecutado} />
      {ejecucion.budgetId && <DF label="Vinculado a presupuesto" v={ejecucion.budgetId} />}
    </>
  );
}

function EjecucionView({ ejecucion, companyId }: { ejecucion: Ejecucion; companyId: string; onClose: () => void }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState('');
  const [viewBudget, setViewBudget] = useState<Budget | null>(null);

  useEffect(() => {
    const unsub = subscribeBudgets(companyId, setBudgets);
    return () => unsub();
  }, [companyId]);

  const filtered = search ? budgets.filter(b => b.descripcion.toLowerCase().includes(search.toLowerCase()) || b.proyectoAsignado.toLowerCase().includes(search.toLowerCase())) : budgets;
  const linkedBudget = budgets.find(b => b.id === ejecucion.budgetId);

  const handleLink = async (budgetId: string) => {
    await updateEjecucion(companyId, ejecucion.id, { budgetId });
  };
  const handleUnlink = async () => {
    await updateEjecucion(companyId, ejecucion.id, { budgetId: '' });
  };

  if (viewBudget) {
    return (
      <>
        <button onClick={() => setViewBudget(null)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-1">← Volver a la ejecución</button>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Detalle de Presupuesto Vinculado</p>
        <DF label="Descripción" v={viewBudget.descripcion} />
        <DF label="Proyecto" v={viewBudget.proyectoAsignado} />
        <DF label="Cliente/Proveedor" v={viewBudget.clienteOProveedor} />
        <DF label="Tipo" v={viewBudget.tipo} />
        <DF label="Monto" v={formatCurrency(viewBudget.montoPresupuestado)} />
        <DF label="Mes" v={viewBudget.mesPresupuestado} />
        <DF label="Estado" v={viewBudget.estadoProyecto} />
      </>
    );
  }

  return (
    <>
      <DF label="Descripción" v={ejecucion.descripcion} />
      <DF label="Proyecto" v={ejecucion.proyectoAsignado} />
      <DF label="Cliente/Proveedor" v={ejecucion.clienteOProveedor} />
      <DF label="Tipo" v={ejecucion.tipo} />
      <DF label="Monto" v={formatCurrency(ejecucion.montoEjecutado)} />
      <DF label="Fecha" v={ejecucion.fechaEjecutado} />

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
          <Link2 size={12} /> Presupuesto vinculado
        </p>
        {linkedBudget ? (
          <div onClick={() => setViewBudget(linkedBudget)} className="flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 rounded-lg p-3 cursor-pointer transition-colors">
            <div>
              <p className="text-xs font-semibold text-indigo-700">{linkedBudget.descripcion}</p>
              <p className="text-[10px] text-indigo-500">{linkedBudget.proyectoAsignado} • {formatCurrency(linkedBudget.montoPresupuestado)}</p>
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
                      <span className="text-slate-400 ml-2">{b.proyectoAsignado} • {formatCurrency(b.montoPresupuestado)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function DF({ label, v }: { label: string; v: string }) { return <div><p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p><p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p></div>; }

function DataPanel({ data, onClose }: { data: SidepanelData; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <div className="p-6 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800">Detalle de Celda</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className={clsx("rounded-xl p-4 border", data.mode === 'Presupuestado' ? "bg-sky-50 border-sky-100 text-sky-900" : "bg-slate-800 border-slate-700 text-white")}>
          <p className={clsx("text-[10px] font-bold uppercase tracking-widest", data.mode === 'Presupuestado' ? "text-sky-600" : "text-slate-400")}>Seleccionado</p>
          <p className="text-sm font-bold mt-1">{data.title}</p>
          <p className="text-xs mt-1 opacity-80">{data.subtitle}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Presupuestos ({data.budgets.length})</p>{data.budgets.map(b => (
          <div key={b.id} className="flex justify-between items-start border-b border-slate-50 pb-2 mb-2">
            <div><p className="text-xs font-semibold text-slate-700">{b.descripcion}</p><p className="text-[10px] text-slate-400">{b.mesPresupuestado} • {b.clienteOProveedor}</p></div>
            <p className="text-xs font-bold text-slate-800">{formatCurrency(b.montoPresupuestado)}</p>
          </div>
        ))}</div>
        <div className="mb-6"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ejecuciones ({data.ejecuciones.length})</p>{data.ejecuciones.map(e => (
          <div key={e.id} className="flex justify-between items-start border-b border-slate-50 pb-2 mb-2">
            <div><p className="text-xs font-semibold text-slate-700">{e.descripcion}</p><p className="text-[10px] text-slate-400">{e.fechaEjecutado} • {e.clienteOProveedor}</p></div>
            <p className="text-xs font-bold text-slate-800">{formatCurrency(e.montoEjecutado)}</p>
          </div>
        ))}</div>
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
