'use client';

import { useState } from 'react';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { DocumentoMedio, TipoDocumentoMedio } from '@/lib/types';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { MultiSearchableSelect } from '@/components/forms/SearchableSelect';
import { PanelHeader } from '@/components/shared/PanelHeader';

// ─── Types ───────────────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: TipoDocumentoMedio; label: string }[] = [
  { value: 'factura_venta', label: 'Factura Venta' },
  { value: 'factura_compra', label: 'Factura Compra' },
  { value: 'extracto_bancario', label: 'Extracto Bancario' },
  { value: 'comprobante_egreso', label: 'Comprobante Egreso' },
  { value: 'comprobante_ingreso', label: 'Comprobante Ingreso' },
  { value: 'planilla', label: 'Planilla' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'otro', label: 'Otro' },
];

export interface DocumentoSidepanelProps {
  companyId: string;
  documento: DocumentoMedio;
  terceroOptions: { value: string; label: string }[];
  proyectoOptions: { value: string; label: string }[];
  ejecucionOptions: { value: string; label: string }[];
  onSave: (data: {
    tipoDocumento: TipoDocumentoMedio;
    periodo: string;
    terceroId: string;
    projectId?: string;
    ejecucionIds: string[];
    metadata?: {
      nit?: string;
      proveedorTexto?: string;
      montoTotal?: number;
      fechaDocumento?: string;
    };
  }) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
  canGoBack: boolean;
  saving?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function DocumentoSidepanel({
  companyId,
  documento,
  terceroOptions,
  proyectoOptions,
  ejecucionOptions,
  onSave,
  onClose,
  onBack,
  canGoBack,
  saving: externalSaving = false,
}: DocumentoSidepanelProps) {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoMedio | ''>('');
  const [periodo, setPeriodo] = useState('');
  const [terceroId, setTerceroId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [ejecucionIds, setEjecucionIds] = useState<string[]>([]);
  const [nit, setNit] = useState('');
  const [proveedorTexto, setProveedorTexto] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [fechaDocumento, setFechaDocumento] = useState('');
  const [error, setError] = useState('');
  const [internalSaving, setInternalSaving] = useState(false);

  const saving = internalSaving || externalSaving;

  const handleSave = async () => {
    setError('');

    // Validate
    if (!tipoDocumento) {
      setError('Debe seleccionar un tipo de documento');
      return;
    }
    if (!periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      setError('Debe ingresar un período (YYYY-MM)');
      return;
    }

    setInternalSaving(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (nit) metadata.nit = nit;
      if (proveedorTexto) metadata.proveedorTexto = proveedorTexto;
      if (montoTotal) metadata.montoTotal = Number(montoTotal);
      if (fechaDocumento) metadata.fechaDocumento = fechaDocumento;

      await onSave({
        tipoDocumento: tipoDocumento as TipoDocumentoMedio,
        periodo,
        terceroId,
        projectId: projectId || undefined,
        ejecucionIds,
        metadata: Object.keys(metadata).length > 0 ? metadata as any : undefined,
      });
    } catch {
      setError('Error al guardar. Intentá de nuevo.');
    } finally {
      setInternalSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader
        title="Clasificar Documento"
        canGoBack={canGoBack}
        onBack={onBack}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto">
        {/* ── PDF Preview ── */}
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
            {documento.mimeType === 'application/pdf' ? (
              <iframe
                src={`${documento.url}#view=FitH`}
                title="Vista previa del documento"
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <FileText size={32} />
                <span className="text-xs">Vista previa no disponible</span>
              </div>
            )}
          </div>
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">
                {documento.fileName}
              </p>
              <p className="text-[10px] text-slate-400">{formatFileSize(documento.size)}</p>
            </div>
            <a
              href={documento.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 shrink-0 ml-2"
            >
              <ExternalLink size={12} />
              Abrir en nueva pestaña
            </a>
          </div>
        </div>

        {/* ── Classification Form ── */}
        <div className="p-4 space-y-4">
          {/* OCR Stub */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-xs font-medium text-amber-800">
              OCR disponible en futura versión
            </p>
          </div>

          {/* Tipo Documento — Chips */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
              Tipo de Documento <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIPO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipoDocumento(tipoDocumento === opt.value ? '' : opt.value)}
                  disabled={saving}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                    tipoDocumento === opt.value
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                    saving && 'opacity-50 pointer-events-none',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Periodo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Período <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="YYYY-MM"
              disabled={saving}
              className={clsx(
                'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all',
                saving && 'pointer-events-none opacity-50',
              )}
            />
          </div>

          {/* Tercero (required) */}
          <SearchableSelect
            label="Tercero"
            value={terceroId}
            onChange={setTerceroId}
            options={terceroOptions}
            placeholder="Buscar tercero..."
          />

          {/* Proyecto (optional) */}
          <SearchableSelect
            label="Proyecto (opcional)"
            value={projectId}
            onChange={setProjectId}
            options={proyectoOptions}
            placeholder="Buscar proyecto..."
          />

          {/* Ejecuciones (optional, multi-select) */}
          <MultiSearchableSelect
            label="Ejecuciones (opcional)"
            values={ejecucionIds}
            onChange={setEjecucionIds}
            options={ejecucionOptions}
            placeholder="Buscar ejecución..."
          />

          {/* ── Manual Metadata ── */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">
              Metadatos (opcional)
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                placeholder="NIT"
                disabled={saving}
                className={clsx(
                  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none transition-all',
                  saving && 'pointer-events-none opacity-50',
                )}
              />
              <input
                type="text"
                value={proveedorTexto}
                onChange={(e) => setProveedorTexto(e.target.value)}
                placeholder="Proveedor"
                disabled={saving}
                className={clsx(
                  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none transition-all',
                  saving && 'pointer-events-none opacity-50',
                )}
              />
              <input
                type="number"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                placeholder="Monto total"
                disabled={saving}
                className={clsx(
                  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none transition-all',
                  saving && 'pointer-events-none opacity-50',
                )}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-[11px] text-rose-600 font-medium bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all',
            saving
              ? 'bg-indigo-400 text-white cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white',
          )}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Guardando...' : 'Guardar y Enlazar'}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
