'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Budget, Ejecucion, Project, Client, Provider, StateProject, RecordDetail, FormType, MONTHS, Month } from '@/lib/types';
import { subscribeClients, subscribeProjects, subscribeProviders, subscribeStateProjects } from '@/lib/firestore';
import { ChevronDown, ChevronLeft, ChevronRight, Settings, Plus, Pencil, Search, X } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

type TabType = 'Presupuestos' | 'Ejecuciones' | 'Proyectos' | 'Clientes' | 'Proveedores' | 'Configuración';

const PAGE_SIZES = [20, 50, 100, 200];

const estados = ['Activo', 'Cerrado', 'Negociación', 'En ejecución', 'Cancelado'];

export function Datos({
  budgets, ejecuciones, activeTab: initialTab, onTabChange, companyId, onViewRecord, onAddNew, onEditRecord,
}: {
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  companyId: string;
  onViewRecord?: (detail: RecordDetail) => void;
  onAddNew?: (type: FormType) => void;
  onEditRecord?: (form: any) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const tabs: TabType[] = ['Presupuestos', 'Ejecuciones', 'Proyectos', 'Clientes', 'Proveedores', 'Configuración'];
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (initialTab) {
      const formatted = initialTab.charAt(0).toUpperCase() + initialTab.slice(1) as TabType;
      if (tabs.includes(formatted)) return formatted;
    }
    return 'Presupuestos';
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stateProjects, setStateProjects] = useState<StateProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMontoMin, setFilterMontoMin] = useState('');
  const [filterMontoMax, setFilterMontoMax] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => {
    const unsubs = [
      subscribeClients(companyId, setClients, (err) => console.error('Error loading clients:', err)),
      subscribeProjects(companyId, setProjects, (err) => console.error('Error loading projects:', err)),
      subscribeProviders(companyId, setProviders, (err) => console.error('Error loading providers:', err)),
      subscribeStateProjects(setStateProjects, (err) => console.error('Error loading states:', err)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    setFilterTipo('');
    setFilterMonth('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setFilterEstado('');
  }, [activeTab]);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    onTabChange?.(tab.toLowerCase());
  };

  const proyectosConData = projects.map((p) => {
    const bs = budgets.filter((b) => b.proyectoAsignado === p.name);
    const ejs = ejecuciones.filter((e) => e.proyectoAsignado === p.name);
    return { ...p, budgets: bs, ejecuciones: ejs, totalPresupuestado: bs.reduce((s, b) => s + b.montoPresupuestado, 0), totalEjecutado: ejs.reduce((s, e) => s + e.montoEjecutado, 0) };
  });

  const edit = (type: FormType, record: any) => {
    const form = { mode: 'edit' as const, type, record };
    onEditRecord?.(form);
  };

  const ActionCell = ({ children }: { children: React.ReactNode }) => (
    <td className="p-2 text-center">{children}</td>
  );

  const EditBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Editar">
      <Pencil size={14} />
    </button>
  );

  const AddBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <div className="p-4 flex justify-center border-t border-slate-100">
      <button onClick={onClick} className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors">
        <Plus size={14} /> {label}
      </button>
    </div>
  );

  const paginate = <T,>(data: T[]): T[] => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  const searchText = <T extends Record<string, any>>(data: T[], fields: (keyof T)[]): T[] => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(item =>
      fields.some(field => {
        const val = item[field];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  };

  const filteredBudgets = useMemo(() => {
    let data = budgets;
    if (searchQuery) data = searchText(data, ['descripcion', 'proyectoAsignado', 'clienteOProveedor']);
    if (filterTipo) data = data.filter(b => b.tipo === filterTipo);
    if (filterMonth) data = data.filter(b => b.mesPresupuestado === filterMonth);
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(b => b.montoPresupuestado >= min && b.montoPresupuestado <= max);
    return data;
  }, [budgets, searchQuery, filterTipo, filterMonth, filterMontoMin, filterMontoMax]);

  const filteredEjecuciones = useMemo(() => {
    let data = ejecuciones;
    if (searchQuery) data = searchText(data, ['descripcion', 'proyectoAsignado', 'clienteOProveedor']);
    if (filterTipo) data = data.filter(e => e.tipo === filterTipo);
    if (filterDateFrom) data = data.filter(e => e.fechaEjecutado >= filterDateFrom);
    if (filterDateTo) data = data.filter(e => e.fechaEjecutado <= filterDateTo);
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(e => e.montoEjecutado >= min && e.montoEjecutado <= max);
    return data;
  }, [ejecuciones, searchQuery, filterTipo, filterDateFrom, filterDateTo, filterMontoMin, filterMontoMax]);

  const filteredProyectos = useMemo(() => {
    let data = proyectosConData;
    if (searchQuery) data = searchText(data, ['name', 'clientName', 'estado']);
    if (filterEstado) data = data.filter(p => p.estado === filterEstado);
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(p => p.totalPresupuestado >= min && p.totalPresupuestado <= max);
    return data;
  }, [proyectosConData, searchQuery, filterEstado, filterMontoMin, filterMontoMax]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  const filteredProviders = useMemo(() => {
    if (!searchQuery) return providers;
    const q = searchQuery.toLowerCase();
    return providers.filter(p => p.name.toLowerCase().includes(q));
  }, [providers, searchQuery]);

  const filteredStateProjects = useMemo(() => {
    if (!searchQuery) return stateProjects;
    const q = searchQuery.toLowerCase();
    return stateProjects.filter(s => s.name.toLowerCase().includes(q));
  }, [stateProjects, searchQuery]);

  const hasActiveFilters = searchQuery || filterTipo || filterMonth || filterDateFrom || filterDateTo || filterMontoMin || filterMontoMax || filterEstado;

  const clearFilters = () => {
    setFilterTipo('');
    setFilterMonth('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setFilterEstado('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const PaginationControls = ({ totalItems }: { totalItems: number }) => {
    const pages = Math.ceil(totalItems / pageSize) || 1;
    if (totalItems === 0) return null;

    return (
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">
            Mostrando {(currentPage - 1) * pageSize + 1}&ndash;{Math.min(currentPage * pageSize, totalItems)} de {totalItems}
          </span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || (p >= currentPage - 2 && p <= currentPage + 2))
            .map((p, i, arr) => (
              <React.Fragment key={p}>
                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-300 text-[11px]">...</span>}
                <button onClick={() => setCurrentPage(p)}
                  className={clsx("px-2.5 py-1 text-[11px] rounded font-medium transition-colors",
                    currentPage === p ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700')}>
                  {p}
                </button>
              </React.Fragment>
            ))}
          <button disabled={currentPage >= pages} onClick={() => setCurrentPage(p => p + 1)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Base de Datos</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Gestión integral de registros</p>
        </div>
      </header>

      <div className="border-b border-slate-200 px-6 flex gap-0 bg-white shrink-0">
        {tabs.map(tab => (
          <button key={tab}
            className={clsx(
              "px-4 py-2.5 text-xs font-medium transition-colors relative",
              activeTab === tab ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => handleTabClick(tab)}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />}
          </button>
        ))}
      </div>

      <div className="p-4 flex-1 overflow-auto">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col shrink-0">

          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 overflow-x-auto">
            <div className="relative shrink-0 w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text" value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar registros..."
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            {searchQuery && (
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                {activeTab === 'Presupuestos' && `${filteredBudgets.length} resultados`}
                {activeTab === 'Ejecuciones' && `${filteredEjecuciones.length} resultados`}
                {activeTab === 'Proyectos' && `${filteredProyectos.length} resultados`}
                {activeTab === 'Clientes' && `${filteredClients.length} resultados`}
                {activeTab === 'Proveedores' && `${filteredProviders.length} resultados`}
                {activeTab === 'Configuración' && `${filteredStateProjects.length} resultados`}
              </span>
            )}
            {(activeTab === 'Presupuestos' || activeTab === 'Ejecuciones' || activeTab === 'Proyectos') && (
              <>
                <div className="w-px h-6 bg-slate-200 shrink-0" />
                <div className="flex items-center gap-3 shrink-0">
                  {activeTab !== 'Proyectos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Tipo</span>
                      <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setCurrentPage(1); }}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white">
                        <option value="">Todos</option>
                        <option value="ingreso">Ingreso</option>
                        <option value="egreso">Egreso</option>
                      </select>
                    </div>
                  )}
                  {activeTab === 'Presupuestos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Mes</span>
                      <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white">
                        <option value="">Todos</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  )}
                  {activeTab === 'Ejecuciones' && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">Desde</span>
                        <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">Hasta</span>
                        <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                    </>
                  )}
                  {activeTab === 'Proyectos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Estado</span>
                      <select value={filterEstado} onChange={e => { setFilterEstado(e.target.value); setCurrentPage(1); }}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white">
                        <option value="">Todos</option>
                        {estados.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  )}
                  {(activeTab === 'Presupuestos' || activeTab === 'Ejecuciones') && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Monto</span>
                      <input type="number" value={filterMontoMin} onChange={e => { setFilterMontoMin(e.target.value); setCurrentPage(1); }} placeholder="0"
                        className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300" />
                      <span className="text-slate-300 text-[11px]">—</span>
                      <input type="number" value={filterMontoMax} onChange={e => { setFilterMontoMax(e.target.value); setCurrentPage(1); }} placeholder="∞"
                        className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300" />
                    </div>
                  )}
                  {activeTab === 'Proyectos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Presup.</span>
                      <input type="number" value={filterMontoMin} onChange={e => { setFilterMontoMin(e.target.value); setCurrentPage(1); }} placeholder="0"
                        className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300" />
                      <span className="text-slate-300 text-[11px]">—</span>
                      <input type="number" value={filterMontoMax} onChange={e => { setFilterMontoMax(e.target.value); setCurrentPage(1); }} placeholder="∞"
                        className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300" />
                    </div>
                  )}
                  {hasActiveFilters && (
                    <button onClick={clearFilters}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors shrink-0">
                      <X size={12} /> Limpiar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {activeTab === 'Presupuestos' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Descripción</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Proyecto</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Cliente/Prov.</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Mes</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Monto</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredBudgets).map((b) => {
                      const hasEj = ejecuciones.some(e => e.budgetId === b.id);
                      return (<tr key={b.id} className={clsx("cursor-pointer transition-colors", hasEj ? 'hover:bg-slate-50' : 'hover:bg-amber-50/50')} onClick={() => onViewRecord?.({ type: 'budget', budget: b, ejecuciones: ejecuciones.filter(e => e.budgetId === b.id) })}>
                        <td className="p-3 font-semibold text-slate-700">
                          <span className={clsx("inline-block w-2 h-2 rounded-full mr-2 align-middle", hasEj ? 'bg-emerald-400' : 'bg-amber-400')} title={hasEj ? 'Con ejecuciones' : 'Sin ejecuciones'} />
                          {b.descripcion}
                        </td>
                        <td className="p-3 text-slate-600">{b.proyectoAsignado}</td>
                        <td className="p-3 text-slate-500">{b.clienteOProveedor}</td>
                        <td className="p-3"><span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", b.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{b.tipo}</span></td>
                        <td className="p-3 text-slate-600">{b.mesPresupuestado}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(b.montoPresupuestado)}</td>
                        <ActionCell><EditBtn onClick={() => edit('budget', b)} /></ActionCell>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('budget')} label="Nuevo Presupuesto" />
              <PaginationControls totalItems={filteredBudgets.length} />
            </>
          )}

          {activeTab === 'Ejecuciones' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Descripción</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Proyecto</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Cliente/Prov.</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Fecha</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Monto</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredEjecuciones).map((e) => {
                      const hasLink = !!e.budgetId;
                      return (<tr key={e.id} className={clsx("cursor-pointer transition-colors", hasLink ? 'hover:bg-slate-50' : 'hover:bg-amber-50/50')} onClick={() => onViewRecord?.({ type: 'ejecucion', ejecucion: e })}>
                        <td className="p-3 font-semibold text-slate-700">
                          <span className={clsx("inline-block w-2 h-2 rounded-full mr-2 align-middle", hasLink ? 'bg-emerald-400' : 'bg-amber-400')} title={hasLink ? 'Vinculado a presupuesto' : 'Sin presupuesto vinculado'} />
                          {e.descripcion}
                        </td>
                        <td className="p-3 text-slate-600">{e.proyectoAsignado}</td>
                        <td className="p-3 text-slate-500">{e.clienteOProveedor}</td>
                        <td className="p-3"><span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", e.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{e.tipo}</span></td>
                        <td className="p-3 text-slate-600">{e.fechaEjecutado}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(e.montoEjecutado)}</td>
                        <ActionCell><EditBtn onClick={() => edit('ejecucion', e)} /></ActionCell>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('ejecucion')} label="Nueva Ejecución" />
              <PaginationControls totalItems={filteredEjecuciones.length} />
            </>
          )}

          {activeTab === 'Proyectos' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Cliente</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Estado</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Ppios</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Ejecs</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Presup.</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Ejec.</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredProyectos).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onViewRecord?.({ type: 'project', project: p, budgets: p.budgets, ejecuciones: p.ejecuciones })}>
                        <td className="p-3 font-semibold text-slate-700">{p.name}</td>
                        <td className="p-3 text-slate-500">{p.clientName}</td>
                        <td className="p-3"><span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", p.estado === 'Cerrado' ? 'bg-slate-200 text-slate-700' : p.estado === 'Negociación' ? 'bg-orange-100 text-orange-800' : p.estado === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800')}>{p.estado}</span></td>
                        <td className="p-3 text-center text-slate-600 font-medium">{p.budgets.length}</td>
                        <td className="p-3 text-center text-slate-600 font-medium">{p.ejecuciones.length}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(p.totalPresupuestado)}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(p.totalEjecutado)}</td>
                        <ActionCell><EditBtn onClick={() => edit('project', p)} /></ActionCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('project')} label="Nuevo Proyecto" />
              <PaginationControls totalItems={filteredProyectos.length} />
            </>
          )}

          {activeTab === 'Clientes' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredClients).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onViewRecord?.({ type: 'client', client: c, projects: projects.filter(p => p.clientName === c.name) })}>
                        <td className="p-3 font-semibold text-slate-700">{c.name}</td>
                        <ActionCell><EditBtn onClick={() => edit('client', c)} /></ActionCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('client')} label="Nuevo Cliente" />
              <PaginationControls totalItems={filteredClients.length} />
            </>
          )}

          {activeTab === 'Proveedores' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredProviders).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onViewRecord?.({ type: 'provider', provider: p })}>
                        <td className="p-3 font-semibold text-slate-700">{p.name}</td>
                        <ActionCell><EditBtn onClick={() => edit('provider', p)} /></ActionCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('provider')} label="Nuevo Proveedor" />
              <PaginationControls totalItems={filteredProviders.length} />
            </>
          )}

          {activeTab === 'Configuración' && (
            <div className="p-6 space-y-8">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Settings size={16} /> Estados de Proyecto</h3>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr><th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre</th></tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredStateProjects).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-slate-700">{s.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls totalItems={filteredStateProjects.length} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
