'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, FileText, ChevronDown } from 'lucide-react';
import type { DocumentoMedio, NavScreen, Tercero } from '@/lib/types';
import { subscribeDocumentos } from '@/lib/mediaService';
import { subscribeTerceros } from '@/lib/firestore';

// ─── Constants (duplicated inline per existing pattern) ──────────────────────

const TIPO_LABELS: Record<string, string> = {
  factura_venta: 'Factura Venta',
  factura_compra: 'Factura Compra',
  extracto_bancario: 'Extracto Bancario',
  comprobante_egreso: 'Comprobante Egreso',
  comprobante_ingreso: 'Comprobante Ingreso',
  planilla: 'Planilla',
  contrato: 'Contrato',
  otro: 'Otro',
};

const TIPO_COLORS: Record<string, string> = {
  factura_venta: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  factura_compra: 'bg-rose-100 text-rose-700 border-rose-200',
  extracto_bancario: 'bg-blue-100 text-blue-700 border-blue-200',
  comprobante_egreso: 'bg-orange-100 text-orange-700 border-orange-200',
  comprobante_ingreso: 'bg-teal-100 text-teal-700 border-teal-200',
  planilla: 'bg-purple-100 text-purple-700 border-purple-200',
  contrato: 'bg-sky-100 text-sky-700 border-sky-200',
  otro: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatCOP(val: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(val);
}

const SIN_TERCERO_KEY = '__sin_tercero';
const SIN_TERCERO_LABEL = 'Sin tercero';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ExploradorTercerosTabProps {
  companyId: string;
  onNavigate?: (screen: NavScreen) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ExploradorTercerosTab({ companyId, onNavigate }: ExploradorTercerosTabProps) {
  const [documentos, setDocumentos] = useState<DocumentoMedio[] | null>(null);
  const [terceros, setTerceros] = useState<Tercero[] | null>(null);
  const [expandedTerceros, setExpandedTerceros] = useState<Set<string>>(new Set());

  // ── Subscriptions ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubDocs = subscribeDocumentos(
      companyId,
      { status: 'enlazado' },
      (docs) => setDocumentos(docs),
    );
    const unsubTerceros = subscribeTerceros(
      (terceros) => setTerceros(terceros),
    );

    return () => {
      unsubDocs();
      unsubTerceros();
    };
  }, [companyId]);

  // ── Tercero name map ──────────────────────────────────────────────────────
  const terceroMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (terceros) {
      for (const t of terceros) {
        map.set(t.id, t.name);
      }
    }
    return map;
  }, [terceros]);

  // ── Grouping ──────────────────────────────────────────────────────────────
  const grupos = useMemo(() => {
    if (!documentos) return [];
    const map = new Map<string, DocumentoMedio[]>();
    for (const doc of documentos) {
      const key = doc.terceroId ?? SIN_TERCERO_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return Array.from(map.entries()).sort(([aId], [bId]) => {
      const aName = aId === SIN_TERCERO_KEY
        ? SIN_TERCERO_LABEL
        : (terceroMap.get(aId) ?? '—');
      const bName = bId === SIN_TERCERO_KEY
        ? SIN_TERCERO_LABEL
        : (terceroMap.get(bId) ?? '—');
      return aName.localeCompare(bName);
    });
  }, [documentos, terceroMap]);

  // ── Expand / collapse ─────────────────────────────────────────────────────
  const toggleExpand = useCallback((key: string) => {
    setExpandedTerceros((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const loading = documentos === null || terceros === null;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (documentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <FileText size={32} className="mb-2 opacity-50" />
        <p className="text-sm font-medium">No hay documentos enlazados</p>
      </div>
    );
  }

  // ── Groups ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-3">
      {grupos.map(([terceroId, docs]) => {
        const nombre = terceroId === SIN_TERCERO_KEY
          ? SIN_TERCERO_LABEL
          : (terceroMap.get(terceroId) ?? '—');
        const isExpanded = expandedTerceros.has(terceroId);

        return (
          <div key={terceroId}>
            {/* Group header */}
            <button
              onClick={() => toggleExpand(terceroId)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-left"
            >
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform duration-200 ${
                  isExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              />
              <span className="text-sm font-semibold text-slate-800">{nombre}</span>
              <span className="ml-auto text-[11px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                {docs.length}
              </span>
            </button>

            {/* Expanded cards */}
            {isExpanded && (
              <div className="mt-2 space-y-2 pl-4">
                {docs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() =>
                      onNavigate?.({ type: 'entity', entity: 'documento', mode: 'view', record: doc })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-300 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {doc.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {doc.tipoDocumento && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            TIPO_COLORS[doc.tipoDocumento] || TIPO_COLORS.otro
                          }`}
                        >
                          {TIPO_LABELS[doc.tipoDocumento] || doc.tipoDocumento}
                        </span>
                      )}
                      {doc.periodo && (
                        <span className="text-[10px] font-medium text-slate-500">
                          {doc.periodo}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500 truncate mr-2">
                        {doc.metadata?.proveedorTexto || '—'}
                      </span>
                      <span className="text-sm font-bold text-slate-700 shrink-0">
                        {doc.metadata?.montoTotal != null
                          ? formatCOP(Math.round(Number(doc.metadata.montoTotal)))
                          : '—'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
