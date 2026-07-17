'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DocumentoMedio, NavScreen, TipoDocumentoMedio } from '@/lib/types';
import { subscribeDocumentosEnlazados } from '@/lib/mediaService';
import { PERIODO_SIN_ASIGNAR } from '@/lib/schemas';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, LayoutGrid, Table2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ArchivadorTabProps {
  companyId: string;
  selectedPeriod: string;
  activeCategory: TipoDocumentoMedio;
  onPeriodChange: (period: string) => void;
  onCategoryChange: (category: TipoDocumentoMedio) => void;
  onNavigate?: (screen: NavScreen) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIAS: { value: TipoDocumentoMedio; label: string }[] = [
  { value: 'factura_venta', label: 'Factura Venta' },
  { value: 'factura_compra', label: 'Factura Compra' },
  { value: 'extracto_bancario', label: 'Extracto Bancario' },
  { value: 'comprobante_egreso', label: 'Comprobante Egreso' },
  { value: 'comprobante_ingreso', label: 'Comprobante Ingreso' },
  { value: 'planilla', label: 'Planilla' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'otro', label: 'Otro' },
];

const MESES: { value: string; label: string }[] = [
  { value: PERIODO_SIN_ASIGNAR, label: 'Sin periodo' },
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const AÑOS = Array.from({ length: 11 }, (_, i) => String(2020 + i));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCOP(val: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(val);
}

function getMonthLabel(monthValue: string): string {
  if (monthValue === PERIODO_SIN_ASIGNAR) return 'sin periodo';
  return MESES.find((m) => m.value === monthValue)?.label?.toLowerCase() ?? monthValue;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ArchivadorTab({
  companyId,
  selectedPeriod,
  activeCategory,
  onPeriodChange,
  onCategoryChange,
  onNavigate,
}: ArchivadorTabProps) {
  // ── Local selector state (synced from selectedPeriod prop) ──────────────

  const [yearSelect, setYearSelect] = useState('');
  const [monthSelect, setMonthSelect] = useState(PERIODO_SIN_ASIGNAR);

  // Sync local selects when selectedPeriod changes from parent
  useEffect(() => {
    if (!selectedPeriod) return;
    if (selectedPeriod === PERIODO_SIN_ASIGNAR) {
      setMonthSelect(PERIODO_SIN_ASIGNAR);
    } else {
      const [y, m] = selectedPeriod.split('-');
      setYearSelect(y);
      setMonthSelect(m);
    }
  }, [selectedPeriod]);

  // ── Banner: sin_periodo count (getCountFromServer) ──────────────────────

  const [sinPeriodoCount, setSinPeriodoCount] = useState<number | null>(null);
  const [bannerLoading, setBannerLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBannerLoading(true);

    const fetchCount = async () => {
      try {
        const ref = collection(db, `companies/${companyId}/documentos`);
        const q = query(
          ref,
          where('periodo', '==', PERIODO_SIN_ASIGNAR),
          where('status', '==', 'enlazado'),
        );
        const snap = await getCountFromServer(q);
        if (!cancelled) {
          setSinPeriodoCount(snap.data().count);
          setBannerLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSinPeriodoCount(0);
          setBannerLoading(false);
        }
      }
    };

    fetchCount();
    return () => {
      cancelled = true;
    };
  }, [companyId, selectedPeriod]);

  // ── Index-building error state ──────────────────────────────────────────

  const [indexError, setIndexError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // ── Firestore subscription: documents for selectedPeriod ────────────────

  const [allDocs, setAllDocs] = useState<DocumentoMedio[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Todos (muestra todos los tipos) vs categoría específica ─────────
  const [showTodos, setShowTodos] = useState(true);

  useEffect(() => {
    if (!selectedPeriod) return; // hydration guard
    setLoading(true);

    const unsub = subscribeDocumentosEnlazados(
      companyId,
      selectedPeriod,
      (docs) => {
        setAllDocs(docs);
        setLoading(false);
        setIndexError(false);
      },
      (err) => {
        if (
          err?.message?.includes('FAILED_PRECONDITION') ||
          err?.message?.includes('index')
        ) {
          setIndexError(true);
        }
        setLoading(false);
      },
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedPeriod, retryKey]);

  // ── Client-side grouping by tipoDocumento ───────────────────────────────

  const grouped = useMemo(() => {
    const map = new Map<TipoDocumentoMedio, DocumentoMedio[]>();
    for (const doc of allDocs) {
      const cat = doc.tipoDocumento || 'otro';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(doc);
    }
    return map;
  }, [allDocs]);

  const activeDocs = showTodos ? allDocs : (grouped.get(activeCategory) ?? []);

  // ── SafeSum ─────────────────────────────────────────────────────────────

  const { sum, docsWithMonto, totalDocs } = useMemo(() => {
    let sum = 0;
    let docsWithMonto = 0;
    for (const doc of activeDocs) {
      const monto = Number(doc.metadata?.montoTotal);
      if (!isNaN(monto) && doc.metadata?.montoTotal !== undefined) {
        sum += monto;
        docsWithMonto++;
      }
    }
    return { sum: Math.round(sum), docsWithMonto, totalDocs: activeDocs.length };
  }, [activeDocs]);

  // ── Vista: tabla (default) vs tarjetas ───────────────────────────────
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('archivador-viewmode');
      if (saved === 'table' || saved === 'cards') return saved;
    }
    return 'table';
  });

  // Persist preference
  useEffect(() => {
    localStorage.setItem('archivador-viewmode', viewMode);
  }, [viewMode]);

  // Agrupar docs por periodo (YYYY-MM) para la vista tabla
  const docsByPeriod = useMemo(() => {
    const map = new Map<string, DocumentoMedio[]>();
    for (const doc of activeDocs) {
      const p = doc.periodo || PERIODO_SIN_ASIGNAR;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(doc);
    }
    return map;
  }, [activeDocs]);

  const sortedPeriods = useMemo(
    () => [...docsByPeriod.keys()].sort().reverse(),
    [docsByPeriod],
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleYearChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newYear = e.target.value;
      setYearSelect(newYear);
      if (monthSelect !== PERIODO_SIN_ASIGNAR) {
        onPeriodChange(`${newYear}-${monthSelect}`);
      }
    },
    [monthSelect, onPeriodChange],
  );

  const handleMonthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMonth = e.target.value;
      setMonthSelect(newMonth);
      if (newMonth === PERIODO_SIN_ASIGNAR) {
        onPeriodChange(PERIODO_SIN_ASIGNAR);
      } else {
        onPeriodChange(`${yearSelect}-${newMonth}`);
      }
    },
    [yearSelect, onPeriodChange],
  );

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const handleBannerClick = useCallback(() => {
    onPeriodChange(PERIODO_SIN_ASIGNAR);
  }, [onPeriodChange]);

  // ── Derived values ──────────────────────────────────────────────────────

  const yearDisabled = monthSelect === PERIODO_SIN_ASIGNAR;
  const mesLabel = getMonthLabel(monthSelect);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* ── BannerSinPeriodo ──────────────────────────────────────────── */}
      {!bannerLoading && sinPeriodoCount !== null && sinPeriodoCount > 0 && (
        <button
          type="button"
          onClick={handleBannerClick}
          className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-left hover:bg-amber-100 transition-colors"
        >
          <span className="text-sm text-amber-800 font-medium">
            {sinPeriodoCount} documento{sinPeriodoCount !== 1 ? 's' : ''} sin periodo asignado
          </span>
        </button>
      )}

      {/* ── Selector Año-Mes + Vista ──────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={yearSelect}
          onChange={handleYearChange}
          disabled={yearDisabled}
          className={`border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none ${
            yearDisabled ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-slate-700'
          }`}
          aria-label="Año"
        >
          {yearDisabled ? (
            <option value="">—</option>
          ) : (
            AÑOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))
          )}
        </select>

        <select
          value={monthSelect}
          onChange={handleMonthChange}
          className="border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none text-slate-700"
          aria-label="Mes"
        >
          {MESES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'table'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Table2 size={14} /> Tabla
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'cards'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutGrid size={14} /> Tarjetas
          </button>
        </div>
      </div>

      {/* ── Category Tabs (Todos + 8 tipos) ──────────────────────────── */}
      <div className="border-b border-slate-200 flex gap-0 overflow-x-auto">
        <button
          onClick={() => setShowTodos(true)}
          className={`px-3 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-1.5 shrink-0 ${
            showTodos
              ? 'text-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Todos
          <span className={`text-xs ${showTodos ? 'text-indigo-400' : 'text-slate-400'}`}>
            ({allDocs.length})
          </span>
          {showTodos && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
        {CATEGORIAS.map((cat) => {
          const count = grouped.get(cat.value)?.length ?? 0;
          const isActive = !showTodos && cat.value === activeCategory;
          return (
            <button
              key={cat.value}
              onClick={() => { setShowTodos(false); onCategoryChange(cat.value); }}
              className={`px-3 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {cat.label}
              <span
                className={`text-xs ${
                  isActive ? 'text-indigo-400' : 'text-slate-400'
                }`}
              >
                ({count})
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content area: index error / loading / grid / empty ──────────── */}

      {indexError ? (
        /* Index-building state */
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center space-y-3">
          <p className="text-sm text-blue-800">
            Estamos preparando tu archivador por primera vez, esto tomará un par de minutos...
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : loading && !allDocs.length ? (
        /* Loading state — only on initial load */
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-indigo-600" />
          <span className="ml-2 text-sm text-slate-500">Cargando documentos...</span>
        </div>
      ) : (
        /* Grid or empty state */
        <div className="space-y-4">
          {activeDocs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-sm text-slate-500">
                No hay documentos de este tipo en {mesLabel}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <>
              {/* ── Vista Tabla ────────────────────────────────────────── */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5">Período</th>
                      <th className="text-left px-3 py-2.5">Fecha</th>
                      <th className="text-left px-3 py-2.5">Tipo</th>
                      <th className="text-left px-3 py-2.5">Proveedor</th>
                      <th className="text-left px-3 py-2.5">NIT</th>
                      <th className="text-right px-3 py-2.5">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedPeriods.map((period) => {
                      const docs = docsByPeriod.get(period)!;
                      const periodSum = docs.reduce(
                        (acc, d) => acc + Math.round(Number(d.metadata?.montoTotal ?? 0)), 0
                      );
                      return (
                        <tr key={period} className="bg-slate-50/50">
                          <td
                            colSpan={6}
                            className="px-3 py-2 font-bold text-slate-700 text-xs"
                          >
                            {period === PERIODO_SIN_ASIGNAR
                              ? 'Sin período'
                              : `${MESES.find((m) => m.value === period.split('-')[1])?.label ?? period} ${period.split('-')[0]}`}
                            {' — '}
                            <span className="font-normal text-slate-400">
                              {docs.length} documento{docs.length !== 1 ? 's' : ''}
                              {' — '}
                              <span className="font-semibold text-slate-600">
                                {formatCOP(periodSum)}
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedPeriods.map((period) =>
                      docsByPeriod.get(period)!.map((doc) => (
                        <tr
                          key={doc.id}
                          onClick={() =>
                            onNavigate?.({
                              type: 'entity',
                              entity: 'documento',
                              mode: 'edit',
                              record: doc,
                            })
                          }
                          className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2 text-slate-400 font-mono">
                            {doc.periodo}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {doc.metadata?.fechaDocumento || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {CATEGORIAS.find((c) => c.value === doc.tipoDocumento)?.label ?? doc.tipoDocumento}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-medium truncate max-w-[200px]">
                            {doc.metadata?.proveedorTexto || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono">
                            {doc.metadata?.nit || '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">
                            {doc.metadata?.montoTotal != null
                              ? formatCOP(Math.round(Number(doc.metadata.montoTotal)))
                              : '—'}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold text-slate-700">
                      <td colSpan={5} className="px-3 py-2.5 text-right">
                        Total general:
                        <span className="ml-2 font-normal text-slate-400">
                          ({docsWithMonto} de {totalDocs} documentos con monto)
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatCOP(sum)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* ── Vista Tarjetas (original) ───────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() =>
                      onNavigate?.({
                        type: 'entity',
                        entity: 'documento',
                        mode: 'edit',
                        record: doc,
                      })
                    }
                    className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-300 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {doc.fileName}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <p className="truncate">
                        {doc.metadata?.proveedorTexto || '—'}
                      </p>
                      <p className="truncate">{doc.projectId || '—'}</p>
                      <p className="font-semibold text-slate-700">
                        {doc.metadata?.montoTotal != null
                          ? formatCOP(Math.round(Number(doc.metadata.montoTotal)))
                          : '—'}
                      </p>
                      <p>{doc.periodo}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* SafeSum (solo en vista cards) */}
          {viewMode === 'cards' && (
            <div className="text-xs text-slate-500">
              Total:{' '}
              <span className="font-semibold text-slate-700">
                {formatCOP(sum)}
              </span>
              <span className="ml-2">
                ({docsWithMonto} de {totalDocs} documentos con monto)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
