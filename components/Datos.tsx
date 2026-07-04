'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Budget, Ejecucion, Project, Tercero, RecordDetail, FormType, MONTHS, Month, SettingsCategorias, SettingsItem, CuentaBancaria, ExtractoBancario } from '@/lib/types';
import { subscribeProjects, subscribeTerceros, subscribeSettings, subscribeCompanySettings, subscribeCuentasBancarias, subscribeExtractos } from '@/lib/firestore';
import { ChevronLeft, ChevronRight, Plus, Pencil, Search, X, Paperclip } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

type TabType = 'Presupuestos' | 'Ejecuciones' | 'Proyectos' | 'Terceros' | 'Settings' | 'Bancos';

const PAGE_SIZES = [20, 50, 100, 200];

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
  const tabs: TabType[] = ['Presupuestos', 'Ejecuciones', 'Proyectos', 'Terceros', 'Settings', 'Bancos'];
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (initialTab) {
      const formatted = initialTab.charAt(0).toUpperCase() + initialTab.slice(1) as TabType;
      if (tabs.includes(formatted)) return formatted;
    }
    return 'Presupuestos';
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [settingsData, setSettingsData] = useState<SettingsCategorias | null>(null);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [extractos, setExtractos] = useState<ExtractoBancario[]>([]);
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
      subscribeProjects(companyId, setProjects, (err) => console.error('Error loading projects:', err)),
      subscribeTerceros(setTerceros, (err) => console.error('Error loading terceros:', err)),
      // TODO: Remove old global subscriber after confirming company-scoped path works
      subscribeSettings(setSettingsData, (err) => console.error('Error loading settings (global fallback):', err)),
      subscribeCompanySettings(companyId, setSettingsData, (err) => console.error('Error loading company settings:', err)),
      subscribeCuentasBancarias(companyId, setCuentas, (err) => console.error('Error loading cuentas:', err)),
      subscribeExtractos(companyId, setExtractos, (err) => console.error('Error loading extractos:', err)),
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
    const bs = budgets.filter((b) => b.projectId === p.id);
    const ejs = ejecuciones.filter((e) => e.projectId === p.id);
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
    if (searchQuery) data = searchText(data, ['descripcion', 'projectName', 'entityName']);
    if (filterTipo) data = data.filter(b => b.tipo === filterTipo);
    if (filterMonth) data = data.filter(b => b.mesPresupuestado === filterMonth);
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(b => b.montoPresupuestado >= min && b.montoPresupuestado <= max);
    return data;
  }, [budgets, searchQuery, filterTipo, filterMonth, filterMontoMin, filterMontoMax]);

  const filteredEjecuciones = useMemo(() => {
    let data = ejecuciones;
    if (searchQuery) data = searchText(data, ['descripcion', 'projectName', 'entityName']);
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
    if (searchQuery) data = searchText(data, ['name', 'descripcion', 'tipoProyectos', 'unidades', 'clientName', 'estado']);
    if (filterEstado) data = data.filter(p => p.estado === filterEstado);
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(p => p.totalPresupuestado >= min && p.totalPresupuestado <= max);
    return data;
  }, [proyectosConData, searchQuery, filterEstado, filterMontoMin, filterMontoMax]);

  const filteredTerceros = useMemo(() => {
    if (!searchQuery) return terceros;
    const q = searchQuery.toLowerCase();
    return terceros.filter(t =>
      [t.name, t.apodo, t.lugar, t.tipo, t.documento].some(f => f?.toLowerCase().includes(q))
    );
  }, [terceros, searchQuery]);

  const filteredCuentas = useMemo(() => {
    let data = cuentas;
    if (searchQuery) data = searchText(data, ['nombre', 'banco']);
    return data;
  }, [cuentas, searchQuery]);

  const stateColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (settingsData?.stateProject || []).forEach((s: SettingsItem) => map.set(s.name, s.color));
    return map;
  }, [settingsData]);

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
                {activeTab === 'Terceros' && `${filteredTerceros.length} resultados`}
                {activeTab === 'Bancos' && `${filteredCuentas.length} resultados`}
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
                        {(settingsData?.stateProject || [])
                          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                          .map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
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
                        <td className="p-3 text-slate-600">{b.projectName}</td>
                        <td className="p-3 text-slate-500">{b.entityName}</td>
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
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Comp.</th>
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
                        <td className="p-3 text-slate-600">{e.projectName}</td>
                        <td className="p-3 text-slate-500">{e.entityName}</td>
                        <td className="p-3"><span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", e.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{e.tipo}</span></td>
                        <td className="p-3 text-slate-600">{e.fechaEjecutado}</td>
                        <td className="p-3 text-center">
                          {e.comprobantes && e.comprobantes.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-indigo-600" title={`${e.comprobantes.length} comprobante(s)`}>
                              <Paperclip size={13} />
                              <span className="text-[10px] font-bold">{e.comprobantes.length}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
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
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Descripción</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Cantidad</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Unidad</th>
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
                        <td className="p-3 text-slate-600 max-w-[200px] truncate">{p.descripcion ?? '—'}</td>
                        <td className="p-3 text-slate-600">{p.tipoProyectos ?? '—'}</td>
                        <td className="p-3 text-right text-slate-600 font-medium">{p.cantidad ?? '—'}</td>
                        <td className="p-3 text-slate-600">{p.unidades ?? '—'}</td>
                        <td className="p-3 text-slate-500">{p.clientName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            style={{ backgroundColor: (stateColorMap.get(p.estado) || '#6366f1') + '20', color: stateColorMap.get(p.estado) || '#6366f1', borderColor: (stateColorMap.get(p.estado) || '#6366f1') + '40' }}>
                            {p.estado}
                          </span>
                        </td>
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

          {activeTab === 'Terceros' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Apodo</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Naturaleza</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Documento</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">N° Documento</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Lugar</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredTerceros).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onViewRecord?.({ type: 'tercero', tercero: t })}>
                        <td className="p-3 font-semibold text-slate-700">{t.name}</td>
                        <td className="p-3 text-slate-500">{t.apodo ?? '—'}</td>
                        <td className="p-3 text-slate-600">{t.naturaleza ?? '—'}</td>
                        <td className="p-3 text-slate-600">{t.documento ?? '—'}</td>
                        <td className="p-3 text-slate-600">{t.numeroDocumento ?? '—'}</td>
                        <td className="p-3 text-slate-600">{t.lugar ?? '—'}</td>
                        <td className="p-3">
                          <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                            t.tipo === 'cliente' ? 'bg-blue-100 text-blue-700' :
                            t.tipo === 'proveedor' ? 'bg-amber-100 text-amber-700' :
                            'bg-purple-100 text-purple-700'
                          )}>
                            {t.tipo === 'cliente' ? 'Cliente' : t.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}
                          </span>
                        </td>
                        <ActionCell><EditBtn onClick={() => edit('tercero', t)} /></ActionCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('tercero')} label="Nuevo Tercero" />
              <PaginationControls totalItems={filteredTerceros.length} />
            </>
          )}



          {activeTab === 'Bancos' && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Banco</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Número</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Saldo Actual</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredCuentas).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-400 italic">No hay cuentas bancarias registradas</td>
                      </tr>
                    ) : (
                      paginate(filteredCuentas).map((cuenta) => {
                        const isExpanded = expandedRows.has(cuenta.id);
                        const cuentaExtractos = extractos.filter(e => e.accountId === cuenta.id);
                        return (
                          <React.Fragment key={cuenta.id}>
                            <tr
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                              onClick={() => {
                                setExpandedRows(prev => {
                                  const next = new Set(prev);
                                  if (next.has(cuenta.id)) next.delete(cuenta.id);
                                  else next.add(cuenta.id);
                                  return next;
                                });
                              }}
                            >
                              <td className="p-3 font-semibold text-slate-700">
                                <span className="inline-block mr-2 text-slate-400 text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                                {cuenta.nombre}
                              </td>
                              <td className="p-3 text-slate-600">{cuenta.banco}</td>
                              <td className="p-3">
                                <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                  cuenta.tipo === 'Ahorros' ? 'bg-emerald-100 text-emerald-700' :
                                  cuenta.tipo === 'Corriente' ? 'bg-blue-100 text-blue-700' :
                                  cuenta.tipo === 'Tarjeta de Crédito' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                )}>
                                  {cuenta.tipo}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">{cuenta.numero}</td>
                              <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(cuenta.saldoActual)}</td>
                              <ActionCell>
                                <EditBtn onClick={() => edit('cuenta', cuenta)} />
                              </ActionCell>
                            </tr>
                            {isExpanded && (
                              <tr key={`${cuenta.id}-extractos`}>
                                <td colSpan={6} className="p-0 bg-slate-50">
                                  <div className="border-t border-b border-slate-200 mx-3">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100">
                                          <th className="p-2 pl-4 text-[9px] font-bold text-slate-400 uppercase">Mes</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase">Año</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Saldo Inicial</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Saldo Final</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase">Estado</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-[11px] divide-y divide-slate-200">
                                        {cuentaExtractos.length === 0 ? (
                                          <tr>
                                            <td colSpan={6} className="p-4 text-center text-[10px] text-slate-400 italic">Sin extractos para esta cuenta</td>
                                          </tr>
                                        ) : (
                                          cuentaExtractos.map((ext) => (
                                            <tr key={ext.id} className="hover:bg-slate-100 transition-colors">
                                              <td className="p-2 pl-4 text-slate-700 font-medium">{ext.mes}</td>
                                              <td className="p-2 text-slate-600">{ext.anio}</td>
                                              <td className="p-2 text-right text-slate-700">{formatCurrency(ext.saldoInicial)}</td>
                                              <td className="p-2 text-right text-slate-700 font-semibold">{formatCurrency(ext.saldoFinal)}</td>
                                              <td className="p-2">
                                                <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                  ext.estado === 'Conciliado' ? 'bg-emerald-100 text-emerald-700' :
                                                  ext.estado === 'En revisión' ? 'bg-blue-100 text-blue-700' :
                                                  'bg-amber-100 text-amber-700'
                                                )}>
                                                  {ext.estado}
                                                </span>
                                              </td>
                                              <td className="p-2 text-center">
                                                <EditBtn onClick={() => edit('extracto', ext)} />
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                    <div className="p-2 flex justify-center border-t border-slate-200">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onAddNew?.('extracto'); }}
                                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                      >
                                        <Plus size={12} /> Agregar extracto
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <AddBtn onClick={() => onAddNew?.('cuenta')} label="Agregar cuenta" />
              <PaginationControls totalItems={filteredCuentas.length} />
            </>
          )}

          {activeTab === 'Settings' && (
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-slate-800">Configuración</h2>
              <p className="text-xs text-slate-500">Hacé clic en una categoría para editarla.</p>

              {/* StateProject */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onViewRecord?.({ type: 'settings-editor', category: 'stateProject', title: 'Estados de Proyecto', items: settingsData?.stateProject || [] })}>
                  <h3 className="text-sm font-bold text-slate-700">Estados de Proyecto</h3>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {(settingsData?.stateProject || [])
                    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                    .map((s: any) => (
                      <span key={s.name} className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                        style={{ backgroundColor: s.color + '20', color: s.color, borderColor: s.color + '40' }}>
                        {s.name}
                      </span>
                    ))}
                </div>
              </div>

              {/* TipoProyectos */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onViewRecord?.({ type: 'settings-editor', category: 'tipoProyectos', title: 'Tipos de Proyecto', items: settingsData?.tipoProyectos || [] })}>
                  <h3 className="text-sm font-bold text-slate-700">Tipos de Proyecto</h3>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {(settingsData?.tipoProyectos || [])
                    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                    .map((s: any) => (
                      <span key={s.name} className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                        style={{ backgroundColor: s.color + '20', color: s.color, borderColor: s.color + '40' }}>
                        {s.name}
                      </span>
                    ))}
                </div>
              </div>

              {/* Unidades */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onViewRecord?.({ type: 'settings-editor', category: 'unidades', title: 'Unidades', items: settingsData?.unidades || [] })}>
                  <h3 className="text-sm font-bold text-slate-700">Unidades</h3>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {(settingsData?.unidades || [])
                    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                    .map((s: any) => (
                      <span key={s.name} className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                        style={{ backgroundColor: s.color + '20', color: s.color, borderColor: s.color + '40' }}>
                        {s.name}
                      </span>
                    ))}
                </div>
              </div>

              {/* TipoComprobante */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onViewRecord?.({ type: 'settings-editor', category: 'tipoComprobante', title: 'Tipos de Comprobante', items: settingsData?.tipoComprobante || [] })}>
                  <h3 className="text-sm font-bold text-slate-700">Tipos de Comprobante</h3>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {(settingsData?.tipoComprobante || [])
                    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                    .map((s: any) => (
                      <span key={s.name} className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                        style={{ backgroundColor: s.color + '20', color: s.color, borderColor: s.color + '40' }}>
                        {s.name}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
