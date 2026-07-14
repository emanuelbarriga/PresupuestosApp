'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DocumentoMedio, NavScreen, TipoDocumentoMedio } from '@/lib/types';
import { subscribeDocumentosEnlazados } from '@/lib/mediaService';
import { PERIODO_SIN_ASIGNAR } from '@/lib/schemas';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

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

  const activeDocs = grouped.get(activeCategory) ?? [];

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

      {/* ── Selector Año-Mes ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
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
      </div>

      {/* ── 8 Category Tabs ─────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex gap-0 overflow-x-auto">
        {CATEGORIAS.map((cat) => {
          const count = grouped.get(cat.value)?.length ?? 0;
          const isActive = cat.value === activeCategory;
          return (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
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
          ) : (
            <>
              {/* Document grid */}
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

              {/* SafeSum */}
              <div className="text-xs text-slate-500">
                Total:{' '}
                <span className="font-semibold text-slate-700">
                  {formatCOP(sum)}
                </span>
                <span className="ml-2">
                  ({docsWithMonto} de {totalDocs} documentos con monto)
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
