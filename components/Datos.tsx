'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Budget, Ejecucion, Project, Tercero, RecordDetail, FormType, MONTHS, Month, SettingsCategorias, SettingsItem, CuentaBancaria, ExtractoBancario, MovimientoBancario, MovimientoBancarioInput } from '@/lib/types';
import { subscribeProjects, subscribeTerceros, subscribeSettings, subscribeCompanySettings, subscribeCuentasBancarias, subscribeExtractos, subscribeMovimientos, deleteMovimiento, deleteExtracto, batchAddMovimientos, updateExtracto, setCuentaPredeterminada, countEjecucionesByTercero, deleteTercero } from '@/lib/firestore';
import { ChevronLeft, ChevronRight, Plus, Pencil, Search, X, Paperclip, Trash2, List, TrendingUp, TrendingDown, CheckCircle, XCircle, Download, Eye, FileText, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { MovimientosTable } from '@/components/bancos/MovimientosTable';
import { ExtractoParseModal, type ExtractoParseHeader } from '@/components/bancos/ExtractoParseModal';
import { derivarEstadoComprobantes, REQUIRED_COMPROBANTE_TYPES } from '@/lib/comprobantes';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

type TabType = 'Presupuestos' | 'Ejecuciones' | 'Proyectos' | 'Terceros' | 'Settings' | 'Bancos';

const PAGE_SIZES = [20, 50, 100, 200];

const DISTRIBUTION_POWER = 0.35;

const RangeSlider = ({ min, max, values, onChange, formatLabel }: {
  min: number; max: number;
  values: [number, number];
  onChange: (v: [number, number]) => void;
  formatLabel: (n: number) => string;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);
  const valuesRef = useRef(values);
  const onChangeRef = useRef(onChange);
  valuesRef.current = values;
  onChangeRef.current = onChange;

  const range = max - min || 1;
  const step = Math.max(1, Math.round(range / 5000));
  const invPower = 1 / DISTRIBUTION_POWER;

  // Non-linear scale: low values get more slider real estate
  const valToPos = (v: number) => Math.pow(Math.max(0, (v - min) / range), DISTRIBUTION_POWER);
  const posToVal = (p: number) => Math.round((min + range * Math.pow(p, invPower)) / step) * step;

  const leftPos = valToPos(values[0]) * 100;
  const rightPos = valToPos(values[1]) * 100;

  const getValueFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return posToVal(p);
  }, [min, range, step]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: PointerEvent) => {
      const v = getValueFromPosition(e.clientX);
      const cur = valuesRef.current;
      if (dragging === 'min') {
        const next = Math.min(v, cur[1]);
        onChangeRef.current([next, cur[1]]);
      } else {
        const next = Math.max(v, cur[0]);
        onChangeRef.current([cur[0], next]);
      }
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, getValueFromPosition]);

  return (
    <div className="relative w-40 h-7 flex items-center select-none touch-none ml-2">
      <div ref={trackRef} className="absolute left-0 right-0 h-1.5 bg-slate-200 rounded-full" />
      <div className="absolute rounded-full h-1.5 bg-indigo-400"
        style={{ left: `${leftPos}%`, right: `${100 - rightPos}%` }} />
      <div
        className="absolute w-4 h-4 rounded-full bg-white border-[3px] border-indigo-500 shadow-md cursor-grab active:cursor-grabbing z-20"
        style={{ left: `calc(${leftPos}% - 8px)`, top: '50%', transform: 'translateY(-50%)' }}
        onPointerDown={e => { e.preventDefault(); setDragging('min'); }} />
      <div
        className="absolute w-4 h-4 rounded-full bg-white border-[3px] border-indigo-500 shadow-md cursor-grab active:cursor-grabbing z-10"
        style={{ left: `calc(${rightPos}% - 8px)`, top: '50%', transform: 'translateY(-50%)' }}
        onPointerDown={e => { e.preventDefault(); setDragging('max'); }} />
      <div className="absolute -bottom-3.5 left-0 right-0 flex justify-between text-[9px] text-slate-400 font-medium pointer-events-none leading-none">
        <span className="bg-white px-0.5">{formatLabel(values[0])}</span>
        <span className="bg-white px-0.5">{formatLabel(values[1])}</span>
      </div>
    </div>
  );
};

export function Datos({
  budgets, ejecuciones, activeTab: initialTab, onTabChange, companyId, companyName, onViewRecord, onAddNew, onEditRecord, onDeleteEjecucion, onDeleteTercero: parentOnDeleteTercero,
}: {
  budgets: Budget[];
  ejecuciones: Ejecucion[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  companyId: string;
  companyName?: string;
  onViewRecord?: (detail: RecordDetail) => void;
  onAddNew?: (type: FormType, defaults?: Record<string, string>) => void;
  onEditRecord?: (form: any) => void;
  onDeleteEjecucion?: (ejecucionId: string) => void;
  onDeleteTercero?: (terceroId: string) => void;
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
  const [extractoExpandido, setExtractoExpandido] = useState<string | null>(null);
  const [movimientosPorExtracto, setMovimientosPorExtracto] = useState<Record<string, MovimientoBancario[]>>({});
  const extractoUnsubRef = useRef<Map<string, () => void>>(new Map());

  // View/Edit modal for existing extractos
  const [viewModalData, setViewModalData] = useState<{
    open: boolean;
    extractoId: string;
    accountId: string;
    header: ExtractoParseHeader | null;
    movimientos: MovimientoBancarioInput[];
    pdfUrl?: string;
  }>({ open: false, extractoId: '', accountId: '', header: null, movimientos: [] });
  const [viewModalSaving, setViewModalSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMontoMin, setFilterMontoMin] = useState('');
  const [filterMontoMax, setFilterMontoMax] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterComprobante, setFilterComprobante] = useState('');
  const [filterEjecucion, setFilterEjecucion] = useState('');
  const [filterAdjuntos, setFilterAdjuntos] = useState('');
  const [filterBanco, setFilterBanco] = useState('');

  // Persist filters across tab switches via sessionStorage
  const FILTER_KEY = 'datos-filters';
  const restoredRef = useRef(false);
  // Restore FIRST (before save can overwrite)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FILTER_KEY);
      if (saved) {
        const f = JSON.parse(saved);
        setFilterTipo(f.filterTipo ?? '');
        setFilterYear(f.filterYear ?? new Date().getFullYear().toString());
        setFilterMonth(f.filterMonth ?? '');
        setFilterMontoMin(f.filterMontoMin ?? '');
        setFilterMontoMax(f.filterMontoMax ?? '');
        setFilterEstado(f.filterEstado ?? '');
        setFilterComprobante(f.filterComprobante ?? '');
        setFilterEjecucion(f.filterEjecucion ?? '');
        setFilterAdjuntos(f.filterAdjuntos ?? '');
        setFilterBanco(f.filterBanco ?? '');
        setSearchQuery(f.searchQuery ?? '');
        restoredRef.current = true;
      }
    } catch {}
  }, []);

  // Save filters to sessionStorage whenever they change (skip initial save to avoid overwriting restored values)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({
        filterTipo, filterYear, filterMonth, filterMontoMin, filterMontoMax,
        filterEstado, filterComprobante, filterEjecucion, filterAdjuntos, filterBanco,
        searchQuery,
      }));
    } catch {}
  }, [filterTipo, filterYear, filterMonth, filterMontoMin, filterMontoMax,
      filterEstado, filterComprobante, filterEjecucion, filterAdjuntos, filterBanco, searchQuery]);

  useEffect(() => {
    const unsubs = [
      subscribeProjects(companyId, setProjects, () => {}),
      subscribeTerceros(setTerceros, () => {}),
      subscribeSettings(setSettingsData, () => {}),
      subscribeCompanySettings(companyId, setSettingsData, () => {}),
      subscribeCuentasBancarias(companyId, setCuentas, () => {}),
    ];
    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  // Subscribe to extractos PER ACCOUNT (anidados bajo cuentasBancarias/{accountId}/extractos/)
  useEffect(() => {
    const currentMap = extractoUnsubRef.current;
    const subscribed = new Set(currentMap.keys());
    const active = new Set(cuentas.map(c => c.id));

    // Unsubscribe removed accounts
    for (const id of subscribed) {
      if (!active.has(id)) {
        const unsub = currentMap.get(id);
        if (unsub) { unsub(); currentMap.delete(id); }
      }
    }

    // Subscribe new accounts
    for (const cuenta of cuentas) {
      if (!currentMap.has(cuenta.id)) {
        const unsub = subscribeExtractos(
          companyId,
          cuenta.id,
          (exts) => {
            setExtractos(prev => {
              // Replace extractos for this account, keep others unchanged
              const others = prev.filter(e => e.accountId !== cuenta.id);
              return [...others, ...exts];
            });
          },
          () => {},
        );
        currentMap.set(cuenta.id, unsub);
      }
    }

    return () => {
      for (const [, unsub] of currentMap) unsub();
      currentMap.clear();
    };
  }, [companyId, cuentas]);

  const handleTabClick = (tab: TabType) => {
    if (tab !== 'Presupuestos' && tab !== 'Ejecuciones') {
      clearFilters();
      try { sessionStorage.removeItem(FILTER_KEY); } catch {}
    }
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

  const toggleExtractoMovimientos = useCallback((extractoId: string) => {
    setExtractoExpandido(prev => {
      // If collapsing, unsubscribe
      if (prev === extractoId) {
        const unsub = extractoUnsubRef.current.get(extractoId);
        if (unsub) { unsub(); extractoUnsubRef.current.delete(extractoId); }
        return null;
      }
      // Unsubscribe previous if any
      if (prev && extractoUnsubRef.current.has(prev)) {
        extractoUnsubRef.current.get(prev)!();
        extractoUnsubRef.current.delete(prev);
      }
      // Find the extracto to get accountId
      const ext = extractos.find(e => e.id === extractoId);
      if (!ext) {
        return extractoId;
      }
      const unsub = subscribeMovimientos(
        companyId,
        ext.accountId,
        extractoId,
        (movs) => {
          setMovimientosPorExtracto(prev => {
            return { ...prev, [extractoId]: movs };
          });
        },
        () => {},
      );
      extractoUnsubRef.current.set(extractoId, unsub);
      return extractoId;
    });
  }, [companyId, extractos]);

  const handleDeleteMovimiento = useCallback(async (movimientoId: string) => {
    if (!extractoExpandido) return;
    const ext = extractos.find(e => e.id === extractoExpandido);
    if (!ext) return;
    try {
      await deleteMovimiento(companyId, ext.accountId, extractoExpandido, movimientoId);
    } catch (err) {
    }
  }, [companyId, extractoExpandido, extractos]);

  const handleViewExtracto = useCallback((ext: ExtractoBancario, movs: MovimientoBancario[]) => {
    const cuenta = cuentas.find(c => c.id === ext.accountId);
    const banco = (cuenta?.banco as any) ?? 'No detectado';
    // Subscribe movimientos if not already loaded
    if (extractoExpandido !== ext.id &&
        (ext.estado === 'Completado' || ext.estado === 'Error de parseo')) {
      toggleExtractoMovimientos(ext.id);
    }
    setViewModalData({
      open: true,
      extractoId: ext.id,
      accountId: ext.accountId,
      header: {
        mes: (ext.mes as any) ?? '',
        anio: ext.anio ?? new Date().getFullYear(),
        banco,
        saldoInicial: ext.saldoInicial ?? 0,
        saldoFinal: ext.saldoFinal ?? 0,
      },
      movimientos: movs,
      pdfUrl: ext.archivo?.url,
    });
  }, [cuentas, extractoExpandido, toggleExtractoMovimientos]);

  const handleDeleteExtracto = useCallback(async (ext: ExtractoBancario) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      toast((t) => (
        <div className="text-sm space-y-3">
          <p className="text-slate-700 font-medium">¿Borrar extracto de {ext.mes} {ext.anio}?</p>
          <p className="text-xs text-slate-500">Se eliminarán todos los movimientos asociados.</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { toast.dismiss(t.id); resolve(false); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              No
            </button>
            <button
              onClick={() => { toast.dismiss(t.id); resolve(true); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
            >
              Sí
            </button>
          </div>
        </div>
      ), { duration: Infinity });
    });
    if (!confirmed) return;
    try {
      await deleteExtracto(companyId, ext.accountId, ext.id);
    } catch (err) {
      toast.error('Error al borrar el extracto.');
    }
  }, [companyId]);

  const handleViewSave = useCallback(async (header: ExtractoParseHeader) => {
    if (!viewModalData.extractoId || !viewModalData.accountId) return;
    setViewModalSaving(true);
    try {
      const eid = viewModalData.extractoId;
      const aid = viewModalData.accountId;
      const movs = viewModalData.movimientos ?? [];

      // Build clean movimiento objects
      const cleanMovs = movs.map((m) => ({
        fecha: m.fecha,
        descripcion: m.descripcion,
        debito: m.debito,
        credito: m.credito,
        saldo: m.saldo,
        moneda: m.moneda ?? 'COP',
        ordinal: m.ordinal,
        bancoOrigen: m.bancoOrigen ?? (header.banco as any),
      }));

      // 1. Update extracto header
      await updateExtracto(companyId, aid, eid, {
        mes: header.mes,
        anio: header.anio,
        saldoInicial: header.saldoInicial,
        saldoFinal: header.saldoFinal,
        estado: 'Completado',
        totalMovimientosParseados: cleanMovs.length,
      } as any);

      // 2. Delete old movements using Firebase SDK directly (keep extracto doc)
      const { collection: fsCollection, getDocs, writeBatch } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const movRef = fsCollection(
        db, 'companies', companyId,
        'cuentasBancarias', aid,
        'extractos', eid,
        'movimientos',
      );
      const snap = await getDocs(movRef);
      if (snap.docs.length > 0) {
        const batch = writeBatch(db);
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
      }

      // 3. Add edited movements
      if (cleanMovs.length > 0) {
        await batchAddMovimientos(companyId, aid, eid, cleanMovs);
      }

      setViewModalData(prev => ({ ...prev, open: false }));
    } catch (err) {
      toast.error('Error al guardar los cambios.');
    } finally {
      setViewModalSaving(false);
    }
  }, [companyId, viewModalData.extractoId, viewModalData.accountId, viewModalData.movimientos]);

  const ActionCell = ({ children }: { children: React.ReactNode }) => (
    <td className="p-2 text-center">{children}</td>
  );

  const ViewBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-slate-400 hover:text-indigo-600 transition-colors mr-1" title="Ver">
      <FileText size={14} />
    </button>
  );

  const EditBtn = ({ onClick }: { onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Editar">
      <Pencil size={14} />
    </button>
  );

  const DeleteBtn = ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-500 transition-colors ml-2" title="Borrar">
      <Trash2 size={14} />
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

  const searchText = <T extends Record<string, any>>(data: T[], fields: (keyof T)[], query?: string): T[] => {
    const q = (query ?? searchQuery).toLowerCase();
    if (!q) return data;
    return data.filter(item =>
      fields.some(field => {
        const val = item[field];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  };

  type BudgetSortKey = 'fechaPresupuestado' | 'entityName' | 'projectName' | 'descripcion' | 'montoPresupuestado' | 'totalEjecutado';
  const [budgetSortKey, setBudgetSortKey] = useState<BudgetSortKey>('fechaPresupuestado');
  const [budgetSortDir, setBudgetSortDir] = useState<'asc' | 'desc'>('asc');

  const handleBudgetSort = (key: BudgetSortKey) => {
    if (budgetSortKey === key) {
      setBudgetSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setBudgetSortKey(key);
      setBudgetSortDir('asc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: BudgetSortKey }) => {
    if (budgetSortKey !== columnKey) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-indigo-500">{budgetSortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  type EjecucionSortKey = 'fechaEjecutado' | 'descripcion' | 'projectName' | 'entityName' | 'tipo' | 'montoEjecutado';
  const [ejecucionSortKey, setEjecucionSortKey] = useState<EjecucionSortKey>('fechaEjecutado');
  const [ejecucionSortDir, setEjecucionSortDir] = useState<'asc' | 'desc'>('desc');

  const handleEjecucionSort = (key: EjecucionSortKey) => {
    if (ejecucionSortKey === key) {
      setEjecucionSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setEjecucionSortKey(key);
      setEjecucionSortDir('asc');
    }
  };

  const EjecucionSortIcon = ({ columnKey }: { columnKey: EjecucionSortKey }) => {
    if (ejecucionSortKey !== columnKey) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-indigo-500">{ejecucionSortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const budgetMontoExtent = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const b of budgets) {
      if (b.montoPresupuestado < min) min = b.montoPresupuestado;
      if (b.montoPresupuestado > max) max = b.montoPresupuestado;
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }, [budgets]);

  const ejecucionMontoExtent = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const e of ejecuciones) {
      if (e.montoEjecutado < min) min = e.montoEjecutado;
      if (e.montoEjecutado > max) max = e.montoEjecutado;
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }, [ejecuciones]);

  const TriStateSwitch = <T extends string>({ options, value, onChange, getActiveClass }: {
    options: { value: T; icon: React.ReactNode }[];
    value: T;
    onChange: (v: T) => void;
    getActiveClass?: (v: T) => string;
  }) => (
    <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
      {options.map(opt => {
        const isActive = opt.value === value;
        const activeClass = getActiveClass?.(opt.value) ?? 'bg-indigo-500';
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={clsx(
              "flex items-center justify-center w-7 h-7 rounded-md transition-all",
              isActive ? `${activeClass} text-white shadow-sm` : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
            )}>
            {opt.icon}
          </button>
        );
      })}
    </div>
  );

  const searchFields = (query: string): { fields: string[]; q: string } => {
    const match = query.match(/^\/([ptd])\s(.*)$/);
    if (match) {
      const prefix = match[1];
      const q = match[2];
      if (prefix === 'p') return { fields: ['projectName'], q };
      if (prefix === 't') return { fields: ['entityName'], q };
      if (prefix === 'd') return { fields: ['descripcion'], q };
    }
    return { fields: ['descripcion', 'projectName', 'entityName'], q: query };
  };

  const ejecucionIndicator = (b: Budget): { label: string; colorClass: string } => {
    const ejecutado = b.totalEjecutado ?? 0;
    if (ejecutado === 0) return { label: 'Sin', colorClass: 'bg-slate-200 text-slate-500' };
    if (ejecutado >= b.montoPresupuestado) return { label: 'Total', colorClass: 'bg-emerald-100 text-emerald-700' };
    return { label: 'Parcial', colorClass: 'bg-amber-100 text-amber-700' };
  };

  const filteredBudgets = useMemo(() => {
    let data = budgets;
    if (searchQuery) {
      const { fields, q } = searchFields(searchQuery);
      data = searchText(data, fields as (keyof Budget)[], q);
    }
    if (filterTipo) data = data.filter(b => b.tipo === filterTipo);
    if (filterYear) data = data.filter(b => b.fechaPresupuestado?.startsWith(filterYear));
    if (filterMonth) data = data.filter(b => b.mesPresupuestado === filterMonth);
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(b => b.montoPresupuestado >= min && b.montoPresupuestado <= max);
    if (filterEjecucion === 'con') data = data.filter(b => (b.totalEjecutado ?? 0) > 0);
    if (filterEjecucion === 'sin') data = data.filter(b => !(b.totalEjecutado ?? 0));
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (budgetSortKey) {
        case 'fechaPresupuestado': cmp = a.fechaPresupuestado.localeCompare(b.fechaPresupuestado); break;
        case 'entityName':         cmp = a.entityName.localeCompare(b.entityName); break;
        case 'projectName':        cmp = a.projectName.localeCompare(b.projectName); break;
        case 'descripcion':        cmp = a.descripcion.localeCompare(b.descripcion); break;
        case 'montoPresupuestado': cmp = a.montoPresupuestado - b.montoPresupuestado; break;
        case 'totalEjecutado':     cmp = (a.totalEjecutado ?? 0) - (b.totalEjecutado ?? 0); break;
      }
      return budgetSortDir === 'asc' ? cmp : -cmp;
    });
  }, [budgets, searchQuery, filterTipo, filterMonth, filterMontoMin, filterMontoMax, budgetSortKey, budgetSortDir]);

  const filteredEjecuciones = useMemo(() => {
    let data = ejecuciones;
    if (searchQuery) {
      const { fields, q } = searchFields(searchQuery);
      data = searchText(data, fields as (keyof Ejecucion)[], q);
    }
    if (filterTipo) data = data.filter(e => e.tipo === filterTipo);
    if (filterYear) data = data.filter(e => e.fechaEjecutado?.startsWith(filterYear));
    if (filterMonth) {
      const monthIdx = MONTHS.indexOf(filterMonth as Month) + 1;
      const mm = monthIdx.toString().padStart(2, '0');
      data = data.filter(e => e.fechaEjecutado?.substring(5, 7) === mm);
    }
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) data = data.filter(e => e.montoEjecutado >= min && e.montoEjecutado <= max);
    if (filterComprobante === 'Completada') {
      data = data.filter(e => {
        const result = derivarEstadoComprobantes(e.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
        return result.estado === 'Completada';
      });
    } else if (filterComprobante === 'incompleto') {
      data = data.filter(e => {
        const result = derivarEstadoComprobantes(e.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
        return result.estado !== 'Completada';
      });
    }
    if (filterAdjuntos === 'con') data = data.filter(e => (e.comprobantes?.length ?? 0) > 0);
    if (filterAdjuntos === 'sin') data = data.filter(e => (e.comprobantes?.length ?? 0) === 0);
    if (filterBanco === 'con') data = data.filter(e => !!e.cuentaId);
    if (filterBanco === 'sin') data = data.filter(e => !e.cuentaId);
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (ejecucionSortKey) {
        case 'fechaEjecutado': cmp = a.fechaEjecutado.localeCompare(b.fechaEjecutado); break;
        case 'descripcion':    cmp = a.descripcion.localeCompare(b.descripcion); break;
        case 'projectName':    cmp = (a.projectName ?? '').localeCompare(b.projectName ?? ''); break;
        case 'entityName':     cmp = (a.entityName ?? '').localeCompare(b.entityName ?? ''); break;
        case 'tipo':           cmp = a.tipo.localeCompare(b.tipo); break;
        case 'montoEjecutado': cmp = a.montoEjecutado - b.montoEjecutado; break;
      }
      return ejecucionSortDir === 'asc' ? cmp : -cmp;
    });
  }, [ejecuciones, searchQuery, filterTipo, filterYear, filterMonth, filterMontoMin, filterMontoMax, filterComprobante, filterAdjuntos, filterBanco, ejecucionSortKey, ejecucionSortDir]);

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

  // Auto-ajustar currentPage cuando los datos filtrados se achican
  const totalItems = useMemo(() => {
    switch (activeTab) {
      case 'Presupuestos': return filteredBudgets.length;
      case 'Ejecuciones': return filteredEjecuciones.length;
      case 'Proyectos': return filteredProyectos.length;
      case 'Terceros': return filteredTerceros.length;
      case 'Bancos': return filteredCuentas.length;
      default: return 0;
    }
  }, [activeTab, filteredBudgets.length, filteredEjecuciones.length, filteredProyectos.length, filteredTerceros.length, filteredCuentas.length]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [totalItems, pageSize]);

  const downloadCSV = useCallback(() => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const json = (v: any) => esc(JSON.stringify(v));
    let headers: string[];
    let rows: string[][];
    if (activeTab === 'Presupuestos') {
      headers = ['ID', 'Descripción', 'Proyecto ID', 'Proyecto', 'Entidad ID', 'Entidad', 'Tipo Entidad', 'Tipo', 'Monto', 'Mes', 'Fecha', 'Estado Proyecto', 'Archivado', 'Total Ejecutado', 'Ejecuciones Vinculadas'];
      rows = filteredBudgets.map(b => [
        b.id, b.descripcion, b.projectId, b.projectName, b.entityId, b.entityName,
        b.entityType, b.tipo === 'ingreso' ? 'Ingreso' : 'Egreso', b.montoPresupuestado,
        b.mesPresupuestado, b.fechaPresupuestado, b.estadoProyecto, b.archivado ?? false,
        b.totalEjecutado ?? 0, json(b.linkedEjecuciones ?? []),
      ].map(esc));
    } else if (activeTab === 'Ejecuciones') {
      headers = ['ID', 'Descripción', 'Proyecto ID', 'Proyecto', 'Entidad ID', 'Entidad', 'Tipo Entidad', 'Tipo', 'Monto', 'Fecha', 'Cuenta ID', 'Cuenta', 'Comprobantes', 'Archivado'];
      rows = filteredEjecuciones.map(e => [
        e.id, e.descripcion, e.projectId, e.projectName, e.entityId, e.entityName,
        e.entityType, e.tipo === 'ingreso' ? 'Ingreso' : 'Egreso', e.montoEjecutado,
        e.fechaEjecutado, e.cuentaId ?? '', e.cuentaName ?? '', json(e.comprobantes ?? []),
        e.archivado ?? false,
      ].map(esc));
    } else if (activeTab === 'Proyectos') {
      headers = ['ID', 'Nombre', 'Descripción', 'Tipo Proyecto', 'Cantidad', 'Unidades', 'Cliente ID', 'Cliente', 'Estado', 'Solo Egresos', 'Orden', 'Total Presupuestado', 'Total Ejecutado'];
      rows = filteredProyectos.map(p => [
        p.id, p.name, p.descripcion ?? '', p.tipoProyectos ?? '', p.cantidad ?? '',
        p.unidades ?? '', p.clientId, p.clientName, p.estado, p.soloEgresos ?? false,
        p.orden ?? '', (p as any).totalPresupuestado ?? 0, (p as any).totalEjecutado ?? 0,
      ].map(esc));
    } else if (activeTab === 'Terceros') {
      headers = ['ID', 'Nombre', 'Apodo', 'Naturaleza', 'Documento', 'Número Documento', 'Lugar', 'Tipo'];
      rows = filteredTerceros.map(t => [
        t.id, t.name, t.apodo ?? '', t.naturaleza ?? '', t.documento ?? '',
        t.numeroDocumento ?? '', t.lugar ?? '', t.tipo,
      ].map(esc));
    } else if (activeTab === 'Bancos') {
      headers = ['ID', 'Nombre', 'Banco', 'Tipo', 'Número', 'Moneda', 'Saldo Inicial', 'Saldo Actual'];
      rows = filteredCuentas.map(c => [
        c.id, c.nombre, c.banco, c.tipo, c.numero, c.moneda, c.saldoInicial, c.saldoActual,
      ].map(esc));
    } else return;
    const safeCompany = (companyName ?? companyId).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const date = new Date().toISOString().split('T')[0];
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab.toLowerCase()}-${safeCompany}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeTab, filteredBudgets, filteredEjecuciones, filteredProyectos, filteredTerceros, filteredCuentas, companyId, companyName]);

  // Count of ejecuciones per bank account (for Bancos "Ejecuciones" column)
  const ejecucionCountByCuenta = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of ejecuciones) {
      if (e.cuentaId) {
        map.set(e.cuentaId, (map.get(e.cuentaId) ?? 0) + 1);
      }
    }
    return map;
  }, [ejecuciones]);

  const stateColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (settingsData?.stateProject || []).forEach((s: SettingsItem) => map.set(s.name, s.color));
    return map;
  }, [settingsData]);

  const hasActiveFilters = searchQuery || filterTipo || filterMonth || filterMontoMin || filterMontoMax || filterEstado || filterComprobante || filterEjecucion || filterAdjuntos || filterBanco;

  const clearFilters = () => {
    setFilterTipo('');
    setFilterYear(new Date().getFullYear().toString());
    setFilterMonth('');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setFilterEstado('');
    setFilterComprobante('');
    setFilterEjecucion('');
    setFilterAdjuntos('');
    setFilterBanco('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleDeleteTercero = useCallback(async (terceroId: string, terceroName: string) => {
    // Check for asociada ejecuciones
    const count = await countEjecucionesByTercero(companyId, terceroId);
    if (count > 0) {
      toast.error(`No se puede eliminar "${terceroName}" — tiene ${count} ejecución${count !== 1 ? 'es' : ''} asociada${count !== 1 ? 's' : ''}`);
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      toast((t) => (
        <div className="text-sm space-y-3">
          <p className="text-slate-700 font-medium">¿Eliminar tercero &ldquo;{terceroName}&rdquo;?</p>
          <p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => { toast.dismiss(t.id); resolve(false); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">No</button>
            <button onClick={() => { toast.dismiss(t.id); resolve(true); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Sí</button>
          </div>
        </div>
      ), { duration: Infinity });
    });
    if (!confirmed) return;
    try {
      await parentOnDeleteTercero?.(terceroId);
    } catch {
      toast.error('Error al eliminar el tercero');
    }
  }, [companyId, parentOnDeleteTercero]);

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

          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-3 overflow-x-auto overflow-y-hidden">
            <div className="relative shrink-0 w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text" value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar registros… (/p /t /d)"
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            {(() => {
              const prefixMatch = searchQuery.match(/^\/([ptd])\s+.*$/);
              if (!prefixMatch) return null;
              const labels: Record<string, string> = { p: 'Proyecto', t: 'Cliente/Prov.', d: 'Descripción' };
              return (
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded px-1.5 py-1 leading-none shrink-0">
                  {labels[prefixMatch[1]]}
                </span>
              );
            })()}
            {searchQuery && (
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">
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
                  {(activeTab === 'Presupuestos' || activeTab === 'Ejecuciones') && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">Año</span>
                        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setCurrentPage(1); }}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white">
                          {Array.from({ length: 8 }, (_, i) => (new Date().getFullYear() - 5 + i).toString()).map(y =>
                            <option key={y} value={y}>{y}</option>
                          )}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">Mes</span>
                        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white">
                          <option value="">Todos</option>
                          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {activeTab !== 'Proyectos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Tipo</span>
                      <TriStateSwitch
                        options={[
                          { value: '' as const, icon: <List size={13} /> },
                          { value: 'ingreso' as const, icon: <TrendingUp size={13} /> },
                          { value: 'egreso' as const, icon: <TrendingDown size={13} /> },
                        ]}
                        value={filterTipo}
                        onChange={v => { setFilterTipo(v); setCurrentPage(1); }}
                        getActiveClass={v => v === 'ingreso' ? 'bg-emerald-500' : v === 'egreso' ? 'bg-rose-500' : 'bg-indigo-500'}
                      />
                    </div>
                  )}
                  {activeTab === 'Presupuestos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Ejec.</span>
                      <TriStateSwitch
                        options={[
                          { value: '' as const, icon: <List size={13} /> },
                          { value: 'con' as const, icon: <CheckCircle size={13} /> },
                          { value: 'sin' as const, icon: <XCircle size={13} /> },
                        ]}
                        value={filterEjecucion}
                        onChange={v => { setFilterEjecucion(v); setCurrentPage(1); }}
                        getActiveClass={v => v === 'con' ? 'bg-emerald-500' : v === 'sin' ? 'bg-slate-400' : 'bg-indigo-500'}
                      />
                    </div>
                  )}
                  {activeTab === 'Ejecuciones' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Comp.</span>
                      <TriStateSwitch
                        options={[
                          { value: '' as const, icon: <List size={13} /> },
                          { value: 'Completada' as const, icon: <CheckCircle size={13} /> },
                          { value: 'incompleto' as const, icon: <XCircle size={13} /> },
                        ]}
                        value={filterComprobante as '' | 'Completada' | 'incompleto'}
                        onChange={v => { setFilterComprobante(v); setCurrentPage(1); }}
                        getActiveClass={v => v === 'Completada' ? 'bg-emerald-500' : v === 'incompleto' ? 'bg-amber-500' : 'bg-indigo-500'}
                      />
                    </div>
                  )}
                  {activeTab === 'Ejecuciones' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Adj.</span>
                      <TriStateSwitch
                        options={[
                          { value: '' as const, icon: <List size={13} /> },
                          { value: 'con' as const, icon: <Paperclip size={13} /> },
                          { value: 'sin' as const, icon: <XCircle size={13} /> },
                        ]}
                        value={filterAdjuntos as '' | 'con' | 'sin'}
                        onChange={v => { setFilterAdjuntos(v); setCurrentPage(1); }}
                        getActiveClass={v => v === 'con' ? 'bg-emerald-500' : v === 'sin' ? 'bg-slate-400' : 'bg-indigo-500'}
                      />
                    </div>
                  )}
                  {activeTab === 'Ejecuciones' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Banco</span>
                      <TriStateSwitch
                        options={[
                          { value: '' as const, icon: <List size={13} /> },
                          { value: 'con' as const, icon: <CheckCircle size={13} /> },
                          { value: 'sin' as const, icon: <XCircle size={13} /> },
                        ]}
                        value={filterBanco as '' | 'con' | 'sin'}
                        onChange={v => { setFilterBanco(v); setCurrentPage(1); }}
                        getActiveClass={v => v === 'con' ? 'bg-emerald-500' : v === 'sin' ? 'bg-slate-400' : 'bg-indigo-500'}
                      />
                    </div>
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
                  {activeTab === 'Presupuestos' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Monto</span>
                      <RangeSlider
                        min={budgetMontoExtent.min}
                        max={budgetMontoExtent.max}
                        values={[
                          filterMontoMin ? Number(filterMontoMin) : budgetMontoExtent.min,
                          filterMontoMax ? Number(filterMontoMax) : budgetMontoExtent.max,
                        ]}
                        onChange={([lo, hi]) => {
                          setFilterMontoMin(lo > budgetMontoExtent.min ? lo.toString() : '');
                          setFilterMontoMax(hi < budgetMontoExtent.max ? hi.toString() : '');
                          setCurrentPage(1);
                        }}
                        formatLabel={formatCurrency}
                      />
                    </div>
                  )}
                  {activeTab === 'Ejecuciones' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Monto</span>
                      <RangeSlider
                        min={ejecucionMontoExtent.min}
                        max={ejecucionMontoExtent.max}
                        values={[
                          filterMontoMin ? Number(filterMontoMin) : ejecucionMontoExtent.min,
                          filterMontoMax ? Number(filterMontoMax) : ejecucionMontoExtent.max,
                        ]}
                        onChange={([lo, hi]) => {
                          setFilterMontoMin(lo > ejecucionMontoExtent.min ? lo.toString() : '');
                          setFilterMontoMax(hi < ejecucionMontoExtent.max ? hi.toString() : '');
                          setCurrentPage(1);
                        }}
                        formatLabel={formatCurrency}
                      />
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
                  <div className="w-px h-5 bg-slate-200 shrink-0" />
                  <button onClick={downloadCSV} title="Exportar CSV"
                    className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0 flex items-center gap-1 text-[11px] font-medium">
                    <Download size={13} /> CSV
                  </button>
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
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors whitespace-nowrap" onClick={() => handleBudgetSort('fechaPresupuestado')}>
                        Fecha<SortIcon columnKey="fechaPresupuestado" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleBudgetSort('entityName')}>
                        Cliente/Prov.<SortIcon columnKey="entityName" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleBudgetSort('projectName')}>
                        Proyecto<SortIcon columnKey="projectName" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleBudgetSort('descripcion')}>
                        Descripción<SortIcon columnKey="descripcion" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right cursor-pointer select-none hover:text-slate-600 transition-colors whitespace-nowrap" onClick={() => handleBudgetSort('montoPresupuestado')}>
                        Monto<SortIcon columnKey="montoPresupuestado" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right cursor-pointer select-none hover:text-slate-600 transition-colors whitespace-nowrap" onClick={() => handleBudgetSort('totalEjecutado')}>
                        Ejecutado<SortIcon columnKey="totalEjecutado" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-14">Ejec.</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredBudgets).map((b) => {
                      const ejecutado = b.totalEjecutado ?? 0;
                      return (<tr key={b.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => onViewRecord?.({ type: 'budget', budget: b, ejecuciones: [] })}>
                        <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{b.fechaPresupuestado}</td>
                        <td className="p-3 text-slate-500 max-w-[160px] truncate">{b.entityName}</td>
                        <td className="p-3 text-slate-600 max-w-[160px] truncate">{b.projectName}</td>
                        <td className="p-3 font-semibold text-slate-700 max-w-[240px] truncate">{b.descripcion}</td>
                        <td className={clsx("p-3 text-right font-bold tabular-nums", b.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600')}>{formatCurrency(b.montoPresupuestado)}</td>
                        <td className="p-3 text-right font-semibold text-indigo-600 tabular-nums">{ejecutado > 0 ? formatCurrency(ejecutado) : <span className="text-slate-300">—</span>}</td>
                        <td className="p-3 text-center">
                          <span className={clsx("px-1.5 py-0.5 rounded text-[9px] font-bold", ejecucionIndicator(b).colorClass)}>
                            {ejecucionIndicator(b).label}
                          </span>
                        </td>
                        <ActionCell>
                          <EditBtn onClick={() => edit('budget', b)} />
                        </ActionCell>
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
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors whitespace-nowrap" onClick={() => handleEjecucionSort('fechaEjecutado')}>
                        Fecha<EjecucionSortIcon columnKey="fechaEjecutado" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleEjecucionSort('entityName')}>
                        Cliente/Prov.<EjecucionSortIcon columnKey="entityName" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleEjecucionSort('projectName')}>
                        Proyecto<EjecucionSortIcon columnKey="projectName" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleEjecucionSort('descripcion')}>
                        Descripción<EjecucionSortIcon columnKey="descripcion" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right cursor-pointer select-none hover:text-slate-600 transition-colors" onClick={() => handleEjecucionSort('montoEjecutado')}>
                        Monto<EjecucionSortIcon columnKey="montoEjecutado" />
                      </th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Estado</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Comp.</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Banco</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredEjecuciones).map((e) => {
                      const comprobanteCount = e.comprobantes?.length ?? 0;
                      return (<tr key={e.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => onViewRecord?.({ type: 'ejecucion', ejecucion: e })}>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{e.fechaEjecutado}</td>
                        <td className="p-3 text-slate-500">{e.entityName}</td>
                        <td className="p-3 text-slate-600">{e.projectName}</td>
                        <td className="p-3 font-semibold text-slate-700">{e.descripcion}</td>
                        <td className={clsx("p-3 text-right font-bold tabular-nums", e.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600')}>{formatCurrency(e.montoEjecutado)}</td>
                        <td className="p-3 text-center">
                          {(() => {
                            const result = derivarEstadoComprobantes(e.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
                            if (result.estado === 'Completada') {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">Completada</span>;
                            }
                            if (result.estado === 'Falta un comprobante') {
                              const label = result.faltante === 'falta_pago' ? 'Falta pago' : 'Falta cuenta de cobro';
                              return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">{label}</span>;
                            }
                            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">Sin comprobantes</span>;
                          })()}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {comprobanteCount > 0 ? (
                            <span className="inline-flex items-center gap-1" title={`${comprobanteCount} archivo${comprobanteCount !== 1 ? 's' : ''}`}>
                              <Paperclip size={11} className="text-slate-400" />
                              {comprobanteCount}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-3 text-slate-500 max-w-[120px] truncate">
                          {e.cuentaName || <span className="text-slate-300">—</span>}
                        </td>
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
                        <ActionCell>
                          <EditBtn onClick={() => edit('tercero', t)} />
                          <DeleteBtn onDelete={() => handleDeleteTercero(t.id, t.name)} />
                        </ActionCell>
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
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Ejecs</th>
                      <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {paginate(filteredCuentas).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-slate-400 italic">No hay cuentas bancarias registradas</td>
                      </tr>
                    ) : (
                      paginate(filteredCuentas).map((cuenta) => {
                        const isExpanded = expandedRows.has(cuenta.id);
                        const MONTH_ORDER: Record<string, number> = {
                          Enero: 1, Febrero: 2, Marzo: 3, Abril: 4,
                          Mayo: 5, Junio: 6, Julio: 7, Agosto: 8,
                          Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
                        };
                        const cuentaExtractos = extractos
                          .filter(e => e.accountId === cuenta.id)
                          .sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0) || (MONTH_ORDER[a.mes] ?? 0) - (MONTH_ORDER[b.mes] ?? 0));
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCuentaPredeterminada(companyId, cuenta.id).catch(() => toast.error('Error al establecer cuenta predeterminada'));
                                  }}
                                  className="mr-1.5 align-middle transition-colors"
                                  title={cuenta.predeterminada ? 'Cuenta predeterminada' : 'Establecer como predeterminada'}
                                >
                                  <Star size={13} className={cuenta.predeterminada ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'} />
                                </button>
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
                              <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(cuenta.saldoActual ?? cuenta.saldoInicial ?? 0)}</td>
                              <td className="p-3 text-center text-slate-600">
                                {ejecucionCountByCuenta.get(cuenta.id) ?? 0}
                              </td>
                              <ActionCell>
                                <ViewBtn onClick={() => onViewRecord?.({ type: 'cuenta', cuenta })} />
                                <EditBtn onClick={() => edit('cuenta', cuenta)} />
                              </ActionCell>
                            </tr>
                            {isExpanded && (
                              <tr key={`${cuenta.id}-extractos`}>
                                <td colSpan={7} className="p-0 bg-slate-50">
                                  <div className="border-t border-b border-slate-200 mx-3">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100">
                                          <th className="p-2 pl-4 text-[9px] font-bold text-slate-400 uppercase">Mes</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase">Año</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Saldo Inicial</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Saldo Final</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase">Estado</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center">Parseo</th>
                                          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-[11px] divide-y divide-slate-200">
                                        {cuentaExtractos.length === 0 ? (
                                          <tr>
                                            <td colSpan={8} className="p-4 text-center text-[10px] text-slate-400 italic">Sin extractos para esta cuenta</td>
                                          </tr>
                                        ) : (
                                          cuentaExtractos.map((ext) => {
                                            const isExtExpanded = extractoExpandido === ext.id;
                                            const movimientos = movimientosPorExtracto[ext.id] ?? [];
                                            // Parseable states: show cursor pointer
                                            const isParsed = ext.estado === 'Completado' || ext.estado === 'Error de parseo';
                                            return (
                                              <React.Fragment key={ext.id}>
                                                <tr
                                                  className={clsx(
                                                    'transition-colors',
                                                    isParsed ? 'cursor-pointer hover:bg-slate-100' : 'hover:bg-slate-50',
                                                  )}
                                                  onClick={() => isParsed && toggleExtractoMovimientos(ext.id)}
                                                >
                                                  <td className="p-2 pl-4 text-slate-700 font-medium">
                                                    {isParsed && (
                                                      <span className="inline-block mr-2 text-slate-400 text-[10px]">
                                                        {isExtExpanded ? '▼' : '▶'}
                                                      </span>
                                                    )}
                                                    {ext.mes}
                                                  </td>
                                                  <td className="p-2 text-slate-600">{ext.anio}</td>
                                                  <td className="p-2 text-right text-slate-700">{formatCurrency(ext.saldoInicial)}</td>
                                                  <td className="p-2 text-right text-slate-700 font-semibold">{formatCurrency(ext.saldoFinal)}</td>
                                                  <td className="p-2">
                                                    <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                                      ext.estado === 'Conciliado' ? 'bg-emerald-100 text-emerald-700' :
                                                      ext.estado === 'En revisión' ? 'bg-blue-100 text-blue-700' :
                                                      ext.estado === 'Completado' ? 'bg-green-100 text-green-700' :
                                                      ext.estado === 'Error de parseo' ? 'bg-red-100 text-red-700' :
                                                      ext.estado === 'Parseando' ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-amber-100 text-amber-700'
                                                    )}>
                                                      {ext.estado}
                                                      {ext.totalMovimientosParseados != null && ` (${ext.totalMovimientosParseados})`}
                                                    </span>
                                                  </td>
                                                  <td className="p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleViewExtracto(ext, movimientos); }}
                                                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                                                        title="Ver movimientos"
                                                      >
                                                        <Eye size={14} />
                                                      </button>
                                                      {ext.archivo?.url && (
                                                        <a href={ext.archivo.url} target="_blank" rel="noopener noreferrer"
                                                          className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Abrir PDF">
                                                          <FileText size={14} />
                                                        </a>
                                                      )}
                                                      <ViewBtn onClick={() => onViewRecord?.({ type: 'extracto', extracto: ext })} />
                                                      <EditBtn onClick={() => edit('extracto', ext)} />
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteExtracto(ext); }}
                                                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                                        title="Borrar extracto"
                                                      >
                                                        <Trash2 size={14} />
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                                {isExtExpanded && (
                                                  <tr key={`${ext.id}-movimientos`}>
                                                    <td colSpan={7} className="p-0 bg-white">
                                                      <div className="border-t border-b border-slate-200 mx-0">
                                                        <MovimientosTable
                                                          movimientos={movimientos}
                                                          onDelete={handleDeleteMovimiento}
                                                        />
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
                                    <div className="p-2 flex justify-center border-t border-slate-200">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onAddNew?.('extracto', { accountId: cuenta.id }); }}
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

        {/* View extracto modal — permite corrección posterior */}
        <ExtractoParseModal
          open={viewModalData.open}
          file={null}
          pdfUrl={viewModalData.pdfUrl}
          header={viewModalData.header}
          movimientos={viewModalData.movimientos}
          loading={false}
          saving={viewModalSaving}
          readOnly={false}
          title="Preview de Extracto"
          progress={null}
          error={null}
          onBancoChange={() => {}}
          onMovimientosChange={(movs) => setViewModalData(prev => ({ ...prev, movimientos: movs }))}
          onSave={handleViewSave}
          onCancel={() => setViewModalData(prev => ({ ...prev, open: false }))}
        />
      </div>
    </div>
  );
}
