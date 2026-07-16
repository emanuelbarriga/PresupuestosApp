'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import type { DocumentoMedio, NavScreen } from '@/lib/types';
import { subscribeDocumentos } from '@/lib/mediaService';

// ─── Constants ────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────

interface SoportesTabProps {
  companyId: string;
  terceroId?: string;
  projectId?: string;
  onNavigate: (screen: NavScreen) => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export function SoportesTab({ companyId, terceroId, projectId, onNavigate }: SoportesTabProps) {
  const [documentos, setDocumentos] = useState<DocumentoMedio[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const entityFilter: Record<string, string> = {};
    if (terceroId) entityFilter.terceroId = terceroId;
    if (projectId) entityFilter.projectId = projectId;

    const unsub = subscribeDocumentos(
      companyId,
      { ...entityFilter, status: 'enlazado' } as any,
      (docs) => {
        setDocumentos(docs);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [companyId, terceroId, projectId]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!documentos || documentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <FileText size={32} className="mb-2 opacity-50" />
        <p className="text-sm font-medium">No hay documentos asociados</p>
      </div>
    );
  }

  // ── Document cards ──────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {documentos.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onNavigate({ type: 'entity', entity: 'documento', mode: 'view', record: doc })}
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
  );
}
