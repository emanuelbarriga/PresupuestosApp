'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CuentaBancaria, ExtractoBancario, MovimientoBancario, MONTHS, NavScreen } from '@/lib/types';
import { subscribeCuentasBancarias, subscribeExtractos, subscribeMovimientos, getEjecucion, updateMovimiento } from '@/lib/firestore';
import { deleteDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, X, TrendingUp, TrendingDown, List, Download, ChevronLeft, ChevronRight, Banknote, ArrowRight, CheckSquare, Square, Eye, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

const PAGE_SIZES = [20, 50, 100, 200];

const MONTH_ORDER: Record<string, number> = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4,
  Mayo: 5, Junio: 6, Julio: 7, Agosto: 8,
  Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
};

export function Extractos({ companyId, onNavigate }: { companyId: string; onNavigate?: (screen: NavScreen) => void }) {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [extractosMap, setExtractosMap] = useState<Record<string, ExtractoBancario[]>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [singleMovimientos, setSingleMovimientos] = useState<MovimientoBancario[]>([]);
  const [allMovimientos, setAllMovimientos] = useState<MovimientoBancario[]>([]);
  const [extractoInfo, setExtractoInfo] = useState<{ id: string; mes: string; anio: number } | null>(null);
  const [selectedMovs, setSelectedMovs] = useState<Set<string>>(new Set());
  const [viewAllMode, setViewAllMode] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterTipo, setFilterTipo] = useState(''); // '' | 'debito' | 'credito'
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMontoMin, setFilterMontoMin] = useState('');
  const [filterMontoMax, setFilterMontoMax] = useState('');
  const [filterEjecutado, setFilterEjecutado] = useState(''); // '' | 'si' | 'no'

  // ── Subscriptions ──

  // Cuentas bancarias
  useEffect(() => {
    const unsub = subscribeCuentasBancarias(
      companyId,
      (data) => {
        setCuentas(data);
        // Auto-select predeterminada account first, otherwise first in list
        setSelectedAccountId(prev => {
          if (prev) return prev;
          const pred = data.find(c => c.predeterminada);
          return pred?.id ?? data[0]?.id ?? '';
        });
      },
      () => {},
    );
    return () => unsub();
  }, [companyId]);

  // Extractos per account
  const extractoUnsubs = useRef<Map<string, () => void>>(new Map());
  useEffect(() => {
    const currentSubs = extractoUnsubs.current;
    const activeIds = new Set(cuentas.map(c => c.id));

    // Remove stale subs
    for (const [id, unsub] of currentSubs) {
      if (!activeIds.has(id)) {
        unsub();
        currentSubs.delete(id);
      }
    }

    // Subscribe to new accounts
    for (const cuenta of cuentas) {
      if (!currentSubs.has(cuenta.id)) {
        const unsub = subscribeExtractos(
          companyId,
          cuenta.id,
          (exts) => {
            setExtractosMap(prev => ({ ...prev, [cuenta.id]: exts }));
          },
          () => {},
        );
        currentSubs.set(cuenta.id, unsub);
      }
    }

    return () => {
      for (const [, unsub] of currentSubs) unsub();
      currentSubs.clear();
    };
  }, [companyId, cuentas]);

  // Latest completed extracto for the selected account
  const latestExtracto = useMemo((): ExtractoBancario | null => {
    const exts = extractosMap[selectedAccountId] ?? [];
    const valid = exts.filter(e => e.estado === 'Completado' || e.estado === 'Conciliado');
    valid.sort((a, b) =>
      (b.anio ?? 0) - (a.anio ?? 0) || (MONTH_ORDER[b.mes] ?? 0) - (MONTH_ORDER[a.mes] ?? 0),
    );
    return valid[0] ?? null;
  }, [extractosMap, selectedAccountId]);

  // All extractos for the selected account (for the extracto selector)
  const cuentaExtractos = useMemo((): ExtractoBancario[] => {
    const exts = extractosMap[selectedAccountId] ?? [];
    return [...exts].sort((a, b) =>
      (b.anio ?? 0) - (a.anio ?? 0) || (MONTH_ORDER[b.mes] ?? 0) - (MONTH_ORDER[a.mes] ?? 0),
    );
  }, [extractosMap, selectedAccountId]);

  // Subscribe to movimientos for the selected extracto
  const movimientosUnsub = useRef<(() => void) | null>(null);
  const switchExtracto = useCallback((extractoId: string, mes: string, anio: number) => {
    // Unsubscribe previous
    movimientosUnsub.current?.();
    movimientosUnsub.current = null;

    setExtractoInfo({ id: extractoId, mes, anio });
    setSingleMovimientos([]);

    if (!selectedAccountId || !extractoId) return;

    const unsub = subscribeMovimientos(
      companyId,
      selectedAccountId,
      extractoId,
      (movs) => setSingleMovimientos(movs),
      () => {},
    );
    movimientosUnsub.current = unsub;
  }, [companyId, selectedAccountId]);

  // Auto-select latest extracto when account changes or extractos load
  const prevLatestExtractoId = useRef<string | null>(null);
  useEffect(() => {
    if (!latestExtracto) return;
    if (prevLatestExtractoId.current === latestExtracto.id) return;
    prevLatestExtractoId.current = latestExtracto.id;
    switchExtracto(latestExtracto.id, latestExtracto.mes, latestExtracto.anio);
  }, [latestExtracto, switchExtracto]);

  // Cleanup movimientos subscription on unmount
  useEffect(() => {
    return () => movimientosUnsub.current?.();
  }, []);

  // ── All extractos mode subscriptions ──
  const allMovUnsubs = useRef<Map<string, () => void>>(new Map());

  const cleanupAllMov = useCallback(() => {
    for (const [, unsub] of allMovUnsubs.current) unsub();
    allMovUnsubs.current.clear();
    setAllMovimientos([]);
  }, []);

  // Subscribe to all extractos when viewAllMode is on
  useEffect(() => {
    if (!viewAllMode || !selectedAccountId) {
      cleanupAllMov();
      return;
    }

    const exts = extractosMap[selectedAccountId] ?? [];
    const currentSubs = allMovUnsubs.current;
    const activeExtIds = new Set(exts.map(e => e.id));

    // Remove stale subs
    for (const [extId, unsub] of currentSubs) {
      if (!activeExtIds.has(extId)) { unsub(); currentSubs.delete(extId); }
    }

    // Subscribe new
    for (const ext of exts) {
      if (!currentSubs.has(ext.id)) {
        const unsub = subscribeMovimientos(companyId, selectedAccountId, ext.id, (movs) => {
          setAllMovimientos(prev => {
            // Replace movements for this extracto, keep others
            const others = prev.filter(m => (m as any)._extractoId !== ext.id);
            const tagged = movs.map(m => ({ ...m, _extractoId: ext.id, _extractoMes: ext.mes, _extractoAnio: ext.anio }));
            return [...others, ...tagged];
          });
        }, () => {});
        currentSubs.set(ext.id, unsub);
      }
    }

    // If no extractos, clear
    if (exts.length === 0) setAllMovimientos([]);

    return () => cleanupAllMov();
  }, [viewAllMode, selectedAccountId, extractosMap, companyId, cleanupAllMov]);

  // When switching to single mode, unsubscribe all-movements subs
  useEffect(() => {
    if (!viewAllMode) cleanupAllMov();
  }, [viewAllMode, cleanupAllMov]);

  // Reset viewAllMode on account change
  useEffect(() => {
    setViewAllMode(false);
  }, [selectedAccountId]);

  // ── Derived state ──
  // Movements source: single extracto or all extractos
  const movimientos = viewAllMode ? allMovimientos : singleMovimientos;

  const selectedCuenta = useMemo(
    () => cuentas.find(c => c.id === selectedAccountId),
    [cuentas, selectedAccountId],
  );

  // ── Filters & Sorting ──

  const sortedMovimientos = useMemo(() => {
    return [...movimientos].sort((a, b) =>
      (a.ordinal ?? 0) - (b.ordinal ?? 0) || a.fecha.localeCompare(b.fecha),
    );
  }, [movimientos]);

  const filteredMovimientos = useMemo(() => {
    let data = sortedMovimientos;

    // Search by description or reference
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(m =>
        m.descripcion.toLowerCase().includes(q) ||
        (m.referencia?.toLowerCase().includes(q) ?? false),
      );
    }

    // Type filter
    if (filterTipo === 'debito') data = data.filter(m => m.debito != null && m.debito > 0);
    if (filterTipo === 'credito') data = data.filter(m => m.credito != null && m.credito > 0);

    // Date range
    if (filterDateFrom) data = data.filter(m => m.fecha >= filterDateFrom);
    if (filterDateTo) data = data.filter(m => m.fecha <= filterDateTo);

    // Ejecutado filter
    if (filterEjecutado === 'si') data = data.filter(m => m.convertido === true);
    if (filterEjecutado === 'no') data = data.filter(m => !m.convertido);

    // Amount range
    const min = filterMontoMin ? Number(filterMontoMin) : 0;
    const max = filterMontoMax ? Number(filterMontoMax) : Infinity;
    if (min > 0 || max < Infinity) {
      data = data.filter(m => {
        const monto = m.debito ?? m.credito ?? m.saldo;
        return monto >= min && monto <= max;
      });
    }

    return data;
  }, [sortedMovimientos, searchQuery, filterTipo, filterDateFrom, filterDateTo, filterMontoMin, filterMontoMax, filterEjecutado]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMovimientos.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMovimientos = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredMovimientos.slice(start, start + pageSize);
  }, [filteredMovimientos, safePage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const hasActiveFilters = searchQuery || filterTipo || filterDateFrom || filterDateTo || filterMontoMin || filterMontoMax || filterEjecutado;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterTipo('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMontoMin('');
    setFilterMontoMax('');
    setFilterEjecutado('');
    setCurrentPage(1);
  };

  // ── UI helpers ──

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
          <button key={opt.value} onClick={() => { onChange(opt.value); setCurrentPage(1); }}
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

  const PaginationControls = ({ totalItems }: { totalItems: number }) => {
    const pages = Math.ceil(totalItems / pageSize) || 1;
    if (totalItems === 0) return null;

    return (
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">
            Mostrando {(safePage - 1) * pageSize + 1}&ndash;{Math.min(safePage * pageSize, totalItems)} de {totalItems}
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
          <button disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || (p >= safePage - 2 && p <= safePage + 2))
            .map((p, i, arr) => (
              <React.Fragment key={p}>
                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-300 text-[11px]">...</span>}
                <button onClick={() => setCurrentPage(p)}
                  className={clsx("px-2.5 py-1 text-[11px] rounded font-medium transition-colors",
                    safePage === p ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700')}>
                  {p}
                </button>
              </React.Fragment>
            ))}
          <button disabled={safePage >= pages} onClick={() => setCurrentPage(p => p + 1)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const downloadCSV = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Fecha', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Saldo'];
    const rows = filteredMovimientos.map(m => [
      m.fecha, m.descripcion, m.referencia ?? '',
      m.debito ?? '', m.credito ?? '', m.saldo,
    ].map(esc));

    const safeCompany = (selectedCuenta?.nombre ?? companyId).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = extractoInfo ? `${extractoInfo.mes}-${extractoInfo.anio}` : new Date().toISOString().split('T')[0];
    a.download = `extracto-${safeCompany}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExtractoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [extId, mes, anioStr] = e.target.value.split('|');
    switchExtracto(extId, mes, Number(anioStr));
    setCurrentPage(1);
  };

  // ── Convert to Ejecucion ──

  /** Build sidepanel defaults from a bank movement */
  const movToDefaults = useCallback((mov: MovimientoBancario): Record<string, string> => {
    const isDebito = mov.debito != null && mov.debito > 0;
    return {
      descripcion: mov.descripcion,
      fechaEjecutado: mov.fecha,
      montoEjecutado: String(isDebito ? mov.debito! : mov.credito ?? 0),
      tipo: isDebito ? 'egreso' : 'ingreso',
      cuentaId: selectedAccountId,
      cuentaName: selectedCuenta?.nombre ?? '',
    };
  }, [selectedAccountId, selectedCuenta]);

  /** Open movimiento detail sidepanel with Convertir button */
  const handleViewMovimiento = useCallback((mov: MovimientoBancario) => {
    const movExtractoId = (viewAllMode ? (mov as any)._extractoId : extractoInfo?.id) as string | undefined;
    onNavigate?.({ type: 'entity' as const, entity: 'movimiento' as any, mode: 'view', record: mov, defaults: { cuentaName: selectedCuenta?.nombre ?? '', _cuentaId: selectedAccountId, _extractoId: movExtractoId ?? '' } });
  }, [onNavigate, selectedCuenta, selectedAccountId, extractoInfo, viewAllMode]);

  /** Direct conversion without going through detalle */
  const handleConvertDirect = useCallback((mov: MovimientoBancario) => {
    const isDebito = mov.debito != null && mov.debito > 0;
    const monto = isDebito ? mov.debito! : mov.credito ?? 0;
    // In "Todos" mode, _extractoId comes from the tagged movimiento
    const movExtractoId = (viewAllMode ? (mov as any)._extractoId : extractoInfo?.id) as string | undefined;
    onNavigate?.({
      type: 'entity' as const,
      entity: 'ejecucion' as any,
      mode: 'create',
      defaults: {
        descripcion: mov.descripcion,
        fechaEjecutado: mov.fecha,
        montoEjecutado: String(Math.round(monto)),
        tipo: isDebito ? 'egreso' : 'ingreso',
        cuentaId: selectedAccountId,
        cuentaName: selectedCuenta?.nombre ?? '',
        _cuentaId: selectedAccountId,
        _extractoId: movExtractoId ?? '',
        _movimientoId: mov.id,
      },
    });
  }, [onNavigate, selectedAccountId, selectedCuenta, extractoInfo, viewAllMode]);

  /** Try to find the associated ejecucion by matching data when _ejecucionId is missing */
  const findEjecucionByMovimiento = useCallback(async (mov: MovimientoBancario): Promise<{ id: string } | null> => {
    const monto = mov.debito ?? mov.credito ?? 0;
    try {
      const q = query(
        collection(db, 'companies', companyId, 'ejecuciones'),
        where('cuentaId', '==', selectedAccountId),
        where('fechaEjecutado', '==', mov.fecha),
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        const diff = Math.abs((data.montoEjecutado ?? 0) - monto);
        if (diff < 1) {
          console.log('[Extractos] Ejecucion encontrada por coincidencia:', d.id);
          return { id: d.id };
        }
      }
    } catch (err) {
      console.error('[Extractos] Error buscando ejecucion:', err);
    }
    return null;
  }, [companyId, selectedAccountId]);

  /** Edit the asociada ejecucion */
  const handleEditEjecucion = useCallback(async (mov: MovimientoBancario) => {
    let ejecId = (mov as any)._ejecucionId as string | undefined;
    if (!ejecId) {
      const found = await findEjecucionByMovimiento(mov);
      if (found) ejecId = found.id;
    }
    if (!ejecId) {
      toast.error('No se encontró la ejecución asociada. Reconvertí el movimiento.');
      return;
    }
    try {
      const ejecucion = await getEjecucion(companyId, ejecId);
      if (ejecucion) {
        onNavigate?.({ type: 'entity' as const, entity: 'ejecucion' as any, mode: 'edit', record: ejecucion });
      } else {
        toast.error('La ejecución no existe');
      }
    } catch {
      toast.error('Error al cargar la ejecución');
    }
  }, [companyId, onNavigate, findEjecucionByMovimiento]);

  /** Delete the asociada ejecucion */
  const handleDeleteEjecucion = useCallback(async (mov: MovimientoBancario) => {
    let ejecId = (mov as any)._ejecucionId as string | undefined;
    console.log('[Extractos] handleDeleteEjecucion', { ejecId, movId: mov.id, convertido: mov.convertido });
    if (!ejecId) {
      console.warn('[Extractos] No hay _ejecucionId — buscando por coincidencia...');
      const found = await findEjecucionByMovimiento(mov);
      if (found) {
        ejecId = found.id;
        // Save it back so future lookups work
        const movExtractoId = (mov as any)._extractoId as string | undefined;
        if (selectedAccountId && (movExtractoId || extractoInfo?.id)) {
          updateMovimiento(companyId, selectedAccountId, movExtractoId || extractoInfo!.id!, mov.id, { _ejecucionId: ejecId }).catch((e) => console.error('[Extractos] Error guardando _ejecucionId backfill:', e));
        }
      }
    }
    if (!ejecId) {
      toast.error('No se encontró la ejecución. Reconvertí el movimiento.');
      return;
    }
    const confirmed = await new Promise<boolean>((resolve) => {
      toast((t) => (
        <div className="text-sm space-y-3">
          <p className="text-slate-700 font-medium">¿Eliminar la ejecución asociada?</p>
          <p className="text-xs text-slate-500">El movimiento volverá a estado "no convertido".</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => { toast.dismiss(t.id); resolve(false); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">No</button>
            <button onClick={() => { toast.dismiss(t.id); resolve(true); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">Sí</button>
          </div>
        </div>
      ), { duration: Infinity });
    });
    if (!confirmed) return;

    const delMovExtractoId = (mov as any)._extractoId as string | undefined;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'ejecuciones', ejecId));
      if (selectedAccountId && (delMovExtractoId || extractoInfo?.id)) {
        await updateMovimiento(companyId, selectedAccountId, delMovExtractoId || extractoInfo!.id!, mov.id, { convertido: false, _ejecucionId: '' });
      }
      toast.success('Ejecución eliminada');
    } catch (err) {
      console.error('[Extractos] Error al eliminar ejecucion:', err);
      toast.error('Error al eliminar la ejecución');
    }
  }, [companyId, selectedAccountId, extractoInfo]);

  /** Open bulk conversion sidepanel */
  const handleBulkConvert = useCallback(() => {
    const selected = filteredMovimientos.filter(m => selectedMovs.has(m.id));
    if (selected.length === 0) return;

    onNavigate?.({
      type: 'entity',
      entity: 'convertir-movimientos' as any,
      mode: 'create',
      record: selected,
      defaults: {
        cuentaId: selectedAccountId,
        cuentaName: selectedCuenta?.nombre ?? '',
        extractoId: extractoInfo?.id ?? '',
      },
    });
    setSelectedMovs(new Set());
  }, [filteredMovimientos, selectedMovs, onNavigate, selectedAccountId, selectedCuenta, extractoInfo]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedMovs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = paginatedMovimientos.map(m => m.id);
    setSelectedMovs(prev => {
      const allSelected = pageIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [paginatedMovimientos]);

  // Deselect all when extractoInfo or account changes
  useEffect(() => {
    setSelectedMovs(new Set());
  }, [selectedAccountId, extractoInfo?.id]);

  // ── Render ──

  const sortedCuentas = useMemo(() => {
    return [...cuentas].sort((a, b) => {
      // Predeterminada first, then alphabetical by name
      if (a.predeterminada && !b.predeterminada) return -1;
      if (!a.predeterminada && b.predeterminada) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [cuentas]);

  const cuentaTabs = sortedCuentas.map(c => ({
    id: c.id,
    label: c.nombre,
    banco: c.banco,
  }));

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Extractos Bancarios</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
            Movimientos de cuentas bancarias
          </p>
        </div>
      </header>

      {/* Account Tabs */}
      {cuentaTabs.length > 0 && (
        <div className="border-b border-slate-200 px-6 flex gap-0 bg-white shrink-0 overflow-x-auto">
          {cuentaTabs.map(tab => (
            <button key={tab.id}
              className={clsx(
                "px-4 py-2.5 text-xs font-medium transition-colors relative whitespace-nowrap shrink-0",
                selectedAccountId === tab.id ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => { setSelectedAccountId(tab.id); setCurrentPage(1); }}
            >
              <span className="flex items-center gap-1.5">
                <Banknote size={13} />
                {tab.label}
              </span>
              {selectedAccountId === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="p-4 flex-1 overflow-auto">
        {cuentaTabs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Banknote size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No hay cuentas bancarias registradas</p>
              <p className="text-[11px] text-slate-400 mt-1">Creá una cuenta en la sección Datos &gt; Bancos para empezar.</p>
            </div>
          </div>
        ) : !selectedAccountId ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500">Seleccioná una cuenta bancaria para ver sus extractos.</p>
          </div>
        ) : !extractoInfo ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-slate-500 font-medium">Sin extractos completados</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Subí un extracto para {selectedCuenta?.nombre ?? 'esta cuenta'} desde Datos &gt; Bancos.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col shrink-0">
            {/* Extracto info + Filters bar */}
            <div className="px-4 py-3 border-b border-slate-100 space-y-2">
              {/* Extracto selector and info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
                      {selectedCuenta?.banco}
                    </span>
                    <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
                      <button onClick={() => setViewAllMode(false)}
                        className={clsx("px-2 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap",
                          !viewAllMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}>Último</button>
                      <button onClick={() => setViewAllMode(true)}
                        className={clsx("px-2 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap",
                          viewAllMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}>Todos</button>
                    </div>
                    {cuentaExtractos.length > 1 && (
                      <select
                        value={extractoInfo ? `${extractoInfo.id}|${extractoInfo.mes}|${extractoInfo.anio}` : ''}
                        onChange={handleExtractoChange}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors cursor-pointer bg-white"
                      >
                        {cuentaExtractos.map(ext => (
                          <option key={ext.id} value={`${ext.id}|${ext.mes}|${ext.anio}`}>
                            {ext.mes} {ext.anio} — {ext.estado} ({ext.totalMovimientosParseados ?? 0} movs)
                          </option>
                        ))}
                      </select>
                    )}
                    {cuentaExtractos.length === 1 && extractoInfo && (
                      <span className="text-xs text-slate-600 font-medium">
                        {extractoInfo.mes} {extractoInfo.anio}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {movimientos.length} movimientos
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCuenta && (
                    <span className="text-[10px] text-slate-500">
                      Saldo: <span className="font-bold text-slate-700">{formatCurrency(selectedCuenta.saldoActual ?? 0)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Summary bar */}
              <div className="flex items-center gap-4 text-[11px] pb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Débitos:</span>
                  <span className="font-bold text-rose-600 tabular-nums">
                    {formatCurrency(filteredMovimientos.reduce((s, m) => s + (m.debito ?? 0), 0))}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Créditos:</span>
                  <span className="font-bold text-emerald-600 tabular-nums">
                    {formatCurrency(filteredMovimientos.reduce((s, m) => s + (m.credito ?? 0), 0))}
                  </span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <span className="text-slate-400">
                  <span className="font-semibold text-slate-600">{filteredMovimientos.length}</span> movimientos{selectedMovs.size > 0 ? ` · ${selectedMovs.size} seleccionados` : ''}
                </span>
              </div>

              {/* Filter bar */}
              <div className="flex items-center gap-3 overflow-x-auto overflow-y-hidden pb-0.5">
                <div className="relative shrink-0 w-52">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text" value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Buscar por descripción..."
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-[11px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="w-px h-5 bg-slate-200 shrink-0" />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Tipo</span>
                  <TriStateSwitch
                    options={[
                      { value: '' as const, icon: <List size={12} /> },
                      { value: 'debito' as const, icon: <TrendingDown size={12} /> },
                      { value: 'credito' as const, icon: <TrendingUp size={12} /> },
                    ]}
                    value={filterTipo}
                    onChange={v => setFilterTipo(v)}
                    getActiveClass={v => v === 'debito' ? 'bg-rose-500' : v === 'credito' ? 'bg-emerald-500' : 'bg-indigo-500'}
                  />
                </div>

                <div className="w-px h-5 bg-slate-200 shrink-0" />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Desde</span>
                  <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors w-32" />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Hasta</span>
                  <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors w-32" />
                </div>

                <div className="w-px h-5 bg-slate-200 shrink-0" />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Ejec.</span>
                  <TriStateSwitch
                    options={[
                      { value: '' as const, icon: <List size={12} /> },
                      { value: 'si' as const, icon: <CheckSquare size={12} /> },
                      { value: 'no' as const, icon: <Square size={12} /> },
                    ]}
                    value={filterEjecutado}
                    onChange={v => setFilterEjecutado(v)}
                    getActiveClass={v => v === 'si' ? 'bg-emerald-500' : v === 'no' ? 'bg-slate-400' : 'bg-indigo-500'}
                  />
                </div>

                <div className="w-px h-5 bg-slate-200 shrink-0" />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Monto</span>
                  <input type="number" value={filterMontoMin} onChange={e => { setFilterMontoMin(e.target.value); setCurrentPage(1); }} placeholder="0"
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300" />
                  <span className="text-slate-300 text-[11px]">—</span>
                  <input type="number" value={filterMontoMax} onChange={e => { setFilterMontoMax(e.target.value); setCurrentPage(1); }} placeholder="∞"
                    className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-300" />
                </div>

                {hasActiveFilters && (
                  <button onClick={clearFilters}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors shrink-0">
                    <X size={12} /> Limpiar
                  </button>
                )}

                {searchQuery && (
                  <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                    {filteredMovimientos.length} resultados
                  </span>
                )}

                <div className="w-px h-5 bg-slate-200 shrink-0" />
                <button onClick={downloadCSV} title="Exportar CSV"
                  className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0 flex items-center gap-1 text-[11px] font-medium">
                  <Download size={13} /> CSV
                </button>
                {selectedMovs.size > 0 && (
                  <>
                    <div className="w-px h-5 bg-slate-200 shrink-0" />
                    <button
                      onClick={handleBulkConvert}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      <ArrowRight size={13} />
                      Convertir {selectedMovs.size} mov{selectedMovs.size !== 1 ? 's' : ''}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Seleccionar todos en esta página">
                        {paginatedMovimientos.length > 0 && paginatedMovimientos.every(m => selectedMovs.has(m.id))
                          ? <CheckSquare size={14} className="text-indigo-500" />
                          : <Square size={14} />}
                      </button>
                    </th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Fecha</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Descripción</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right whitespace-nowrap">Débito</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right whitespace-nowrap">Crédito</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Saldo</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-28">Estado</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center w-16">Acción</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] divide-y divide-slate-100">
                  {paginatedMovimientos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-slate-400 italic">
                        {hasActiveFilters
                          ? 'No se encontraron movimientos con los filtros aplicados'
                          : 'Sin movimientos en este extracto'}
                      </td>
                    </tr>
                  ) : (
                    paginatedMovimientos.map((mov) => {
                      const isSelected = selectedMovs.has(mov.id);
                      return (
                      <tr key={mov.id}
                        className={clsx(
                          "transition-colors hover:bg-slate-50",
                          mov.requiereRevision && "bg-amber-50/50",
                          isSelected && "bg-indigo-50/50 hover:bg-indigo-50/70",
                        )}
                      >
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSelect(mov.id)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            {isSelected
                              ? <CheckSquare size={14} className="text-indigo-500" />
                              : <Square size={14} />}
                          </button>
                        </td>
                        <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{mov.fecha}</td>
                        <td className="p-3 text-slate-700 max-w-[280px] truncate group relative" title={mov.descripcion}>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{mov.descripcion}</span>
                            {mov.referencia && (
                              <span className="text-slate-400 text-[9px] font-mono shrink-0">#{mov.referencia}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {mov.debito != null ? (
                            <span className="font-bold text-rose-600 tabular-nums">{formatCurrency(mov.debito)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {mov.credito != null ? (
                            <span className="font-bold text-emerald-600 tabular-nums">{formatCurrency(mov.credito)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(mov.saldo)}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {mov.convertido && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                                ✓ Ejec
                              </span>
                            )}
                            {mov.requiereRevision && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                                ⚠ Revisión
                              </span>
                            )}
                            {mov.posibleDuplicado && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700 whitespace-nowrap">
                                ⓘ Duplicado
                              </span>
                            )}
                            {!mov.convertido && !mov.requiereRevision && !mov.posibleDuplicado && (
                              <span className="text-slate-300 text-[9px]">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => handleViewMovimiento(mov)}
                              className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Ver detalle">
                              <Eye size={14} />
                            </button>
                            {mov.convertido ? (
                              <>
                                <button onClick={() => handleEditEjecucion(mov)}
                                  className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Editar ejecución">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteEjecucion(mov)}
                                  className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Eliminar ejecución">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => handleConvertDirect(mov)}
                                className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Ejecutar (convertir en ejecución)">
                                <ArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})
                  )}
                </tbody>
              </table>
            </div>

            <PaginationControls totalItems={filteredMovimientos.length} />
          </div>
        )}
      </div>
    </div>
  );
}
