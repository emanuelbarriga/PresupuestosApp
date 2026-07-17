'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileText, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { DocumentoMedio, TipoDocumentoMedio } from '@/lib/types';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { MultiSearchableSelect } from '@/components/forms/SearchableSelect';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { PdfViewer } from '@/components/shared/PdfViewer';
import { PERIODO_SIN_ASIGNAR, TIPO_DOCUMENTO_DEFAULT } from '@/lib/schemas';
import { auth } from '@/lib/auth';
import { useHistory } from '@/lib/hooks/useDocumentHistory';

// ─── Types ───────────────────────────────────────────────────────────────

type OcrState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data?: OcrExtractResponse }
  | { status: 'error'; message: string };

interface OcrExtractResponse {
  proveedorTexto: string | null;
  nit: string | null;
  fechaDocumento: string | null;
  montoTotal: number | null;
  tipoDocumentoSugerido?: string | null;
  descripcion?: string | null;
}

type FormState = {
  tipoDocumento: string;
  periodo: string;
  fechaDocumento: string;
  terceroId: string;
  projectId: string;
  ejecucionIds: string[];
  nit: string;
  proveedorTexto: string;
  montoTotal: string;
  descripcion: string;
};

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
  ejecucionOptions: { value: string; label: string; montoEjecutado?: number }[];
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
  onDocumentoUpdated?: (docId: string, periodo: string, tipoDocumento: TipoDocumentoMedio) => void;
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
  onDocumentoUpdated,
}: DocumentoSidepanelProps) {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoMedio | ''>(
    documento.tipoDocumento ?? '',
  );
  const [periodo, setPeriodo] = useState(
    documento.periodo ?? '',
  );
  const [terceroId, setTerceroId] = useState(
    documento.terceroId ?? '',
  );
  const [projectId, setProjectId] = useState(
    documento.projectId ?? '',
  );
  const [ejecucionIds, setEjecucionIds] = useState<string[]>(
    documento.ejecucionIds ?? [],
  );
  const [nit, setNit] = useState(
    documento.metadata?.nit ?? '',
  );
  const [proveedorTexto, setProveedorTexto] = useState(
    documento.metadata?.proveedorTexto ?? '',
  );
  const [montoTotal, setMontoTotal] = useState(
    documento.metadata?.montoTotal?.toString() ?? '',
  );
  const [fechaDocumento, setFechaDocumento] = useState(
    documento.metadata?.fechaDocumento ?? '',
  );
  const [descripcion, setDescripcion] = useState(
    documento.metadata?.descripcion ?? '',
  );
  const [error, setError] = useState('');
  const [internalSaving, setInternalSaving] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState>({ status: 'idle' });

  // ─── Undo / Redo history (hook) ────────────────────────────────────
  const history = useHistory<FormState>(`doc-${documento.id}`, { maxEntries: 50 });
  const isRestoringRef = useRef(false);
  const lastCaptureRef = useRef<FormState | null>(null);

  const captureState = (): FormState => ({
    tipoDocumento: (tipoDocumento as string) || '',
    periodo: periodo || '',
    fechaDocumento: fechaDocumento || '',
    terceroId: terceroId || '',
    projectId: projectId || '',
    ejecucionIds: ejecucionIds ?? [],
    nit: nit || '',
    proveedorTexto: proveedorTexto || '',
    montoTotal: montoTotal || '',
    descripcion: descripcion || '',
  });

  const applyState = (s: FormState) => {
    isRestoringRef.current = true;
    setTipoDocumento((s.tipoDocumento || '') as any);
    setPeriodo(s.periodo || '');
    setFechaDocumento(s.fechaDocumento || '');
    setTerceroId(s.terceroId || '');
    setProjectId(s.projectId || '');
    setEjecucionIds(s.ejecucionIds ?? []);
    setNit(s.nit || '');
    setProveedorTexto(s.proveedorTexto || '');
    setMontoTotal(s.montoTotal || '');
    setDescripcion(s.descripcion || '');
    queueMicrotask(() => {
      isRestoringRef.current = false;
    });
  };

  const handleUndo = useCallback(() => {
    const result = history.undo();
    if (result) {
      applyState(result);
      lastCaptureRef.current = result;
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const result = history.redo();
    if (result) {
      applyState(result);
      lastCaptureRef.current = result;
    }
  }, [history]);

  // On mount: push initial state if history is empty, otherwise restore latest
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return; // guard against StrictMode double-fire
    mountedRef.current = true;

    if (history.entries.length > 0 && history.pointer >= 0) {
      const latest = history.entries[history.pointer];
      if (latest) {
        lastCaptureRef.current = latest;
        applyState(latest);
      }
    } else {
      const initial = captureState();
      history.push(initial);
      lastCaptureRef.current = initial;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps — mount only
  }, []);

  // Debounced auto-capture on field change (800ms)
  useEffect(() => {
    const currentState = captureState();
    const timer = setTimeout(() => {
      if (JSON.stringify(currentState) !== JSON.stringify(lastCaptureRef.current)) {
        history.push(currentState);
        lastCaptureRef.current = currentState;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [tipoDocumento, periodo, fechaDocumento, terceroId, projectId, ejecucionIds, nit, proveedorTexto, montoTotal, descripcion, history]);

  // Immediate capture on blur (no debounce wait)
  const handleBlurCapture = () => {
    const current = captureState();
    if (JSON.stringify(current) !== JSON.stringify(lastCaptureRef.current)) {
      history.push(current);
      lastCaptureRef.current = current;
    }
  };

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Sincronizar periodo cuando cambia la fecha del documento
  // (para que al cambiar la fecha, el documento se ubique en el mes correcto del Archivador)
  useEffect(() => {
    if (fechaDocumento) {
      const derived = fechaDocumento.slice(0, 7);
      if (derived !== periodo) setPeriodo(derived);
    }
  }, [fechaDocumento, periodo]);

  // Re-initialize fields when documento.id changes (e.g., another document clicked)
  const prevDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Skip on initial mount — the mount effect already handles history init
    if (prevDocIdRef.current === null) {
      prevDocIdRef.current = documento.id;
      // Only reset fields from props (don't clear history — mount effect already loaded it)
      setTipoDocumento(documento.tipoDocumento ?? '');
      setPeriodo(documento.periodo ?? '');
      setTerceroId(documento.terceroId ?? '');
      setProjectId(documento.projectId ?? '');
      setEjecucionIds(documento.ejecucionIds ?? []);
      setNit(documento.metadata?.nit ?? '');
      setProveedorTexto(documento.metadata?.proveedorTexto ?? '');
      setMontoTotal(documento.metadata?.montoTotal?.toString() ?? '');
      setFechaDocumento(documento.metadata?.fechaDocumento ?? '');
      setDescripcion(documento.metadata?.descripcion ?? '');
      setError('');
      return;
    }

    // Actual document change — reinit fields + history
    if (prevDocIdRef.current !== documento.id) {
      prevDocIdRef.current = documento.id;
      setTipoDocumento(documento.tipoDocumento ?? '');
      setPeriodo(documento.periodo ?? '');
      setTerceroId(documento.terceroId ?? '');
      setProjectId(documento.projectId ?? '');
      setEjecucionIds(documento.ejecucionIds ?? []);
      setNit(documento.metadata?.nit ?? '');
      setProveedorTexto(documento.metadata?.proveedorTexto ?? '');
      setMontoTotal(documento.metadata?.montoTotal?.toString() ?? '');
      setFechaDocumento(documento.metadata?.fechaDocumento ?? '');
      setDescripcion(documento.metadata?.descripcion ?? '');
      setError('');

      // Re-initialize history for new document
      history.clear();
      const initial: FormState = {
        tipoDocumento: documento.tipoDocumento ?? '',
        periodo: documento.periodo ?? '',
        fechaDocumento: documento.metadata?.fechaDocumento ?? '',
        terceroId: documento.terceroId ?? '',
        projectId: documento.projectId ?? '',
        ejecucionIds: documento.ejecucionIds ?? [],
        nit: documento.metadata?.nit ?? '',
        proveedorTexto: documento.metadata?.proveedorTexto ?? '',
        montoTotal: documento.metadata?.montoTotal?.toString() ?? '',
        descripcion: documento.metadata?.descripcion ?? '',
      };
      history.push(initial);
      lastCaptureRef.current = initial;
    }
  }, [documento.id]);

  const saving = internalSaving || externalSaving;

  // Cuando se selecciona una ejecución, el montoTotal se actualiza al monto de esa ejecución
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (ejecucionIds.length > 0) {
      const firstEj = ejecucionOptions.find((ej) => ej.value === ejecucionIds[0]);
      if (firstEj?.montoEjecutado !== undefined) {
        setMontoTotal(firstEj.montoEjecutado.toString());
      }
    }
  }, [ejecucionIds, ejecucionOptions]);

  // Filtrar ejecuciones según tercero y proyecto seleccionados
  const filteredEjecucionOptions = useMemo(() => {
    let options = ejecucionOptions;

    if (terceroId) {
      const terceroName = terceroOptions.find((o) => (typeof o === 'string' ? o : o.value) === terceroId);
      const label = terceroName ? (typeof terceroName === 'string' ? terceroName : terceroName.label.toLowerCase()) : '';
      if (label) {
        options = options.filter((o) => o.label.toLowerCase().includes(label));
      }
    }

    if (projectId) {
      const proyectoName = proyectoOptions.find((o) => (typeof o === 'string' ? o : o.value) === projectId);
      const label = proyectoName ? (typeof proyectoName === 'string' ? proyectoName : proyectoName.label.toLowerCase()) : '';
      if (label) {
        options = options.filter((o) => o.label.toLowerCase().includes(label.split(' ').slice(0, 2).join(' ')));
      }
    }

    return options;
  }, [ejecucionOptions, terceroId, projectId, terceroOptions, proyectoOptions]);

  const handleSave = async () => {
    setError('');

    // Validate
    if (!tipoDocumento) {
      setError('Debe seleccionar un tipo de documento');
      return;
    }
    setInternalSaving(true);
    try {
      // Derive periodo (YYYY-MM) from fechaDocumento (YYYY-MM-DD) or existing periodo
      const effectivePeriodo = periodo || (fechaDocumento ? fechaDocumento.slice(0, 7) : PERIODO_SIN_ASIGNAR);
      const effectiveTipoDocumento = tipoDocumento || TIPO_DOCUMENTO_DEFAULT;

      const metadata: Record<string, unknown> = {};
      if (nit) metadata.nit = nit;
      if (proveedorTexto) metadata.proveedorTexto = proveedorTexto;
      if (montoTotal) metadata.montoTotal = Number(montoTotal);
      if (fechaDocumento) metadata.fechaDocumento = fechaDocumento;
      if (descripcion) metadata.descripcion = descripcion;

      await onSave({
        tipoDocumento: effectiveTipoDocumento,
        periodo: effectivePeriodo,
        terceroId,
        projectId: projectId || undefined,
        ejecucionIds,
        metadata: Object.keys(metadata).length > 0 ? metadata as any : undefined,
      });

      // Callback after successful save
      onDocumentoUpdated?.(documento.id, effectivePeriodo, effectiveTipoDocumento);
    } catch {
      setError('Error al guardar. Intentá de nuevo.');
    } finally {
      setInternalSaving(false);
    }
  };

  // ── OCR Error Messages ────────────────────────────────────────────────

  const ocrErrorMessage = useCallback((status: number): string => {
    switch (status) {
      case 401: return 'Sesión expirada';
      case 400: return 'Formato no soportado. Usá PDF, PNG o JPG.';
      case 413: return 'El archivo excede el límite de 5MB';
      case 429: return 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.';
      default: return 'Error al extraer datos. Intentá de nuevo.';
    }
  }, []);

  // ── OCR Extraction ─────────────────────────────────────────────────────

  const handleOcrExtract = useCallback(async () => {
    setOcrState({ status: 'loading' });

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setOcrState({ status: 'error', message: 'Sesión expirada' });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storagePath: documento.storagePath,
          tipoDocumento: documento.tipoDocumento ?? undefined,
          terceroCount: terceroOptions.length,
          proyectoCount: proyectoOptions.length,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        setOcrState({ status: 'error', message: ocrErrorMessage(response.status) });
        return;
      }

      const data: OcrExtractResponse = await response.json();
      console.log('[OCR] ✅ Datos extraídos:', JSON.stringify(data));

      // Guardar estado actual en el historial antes del pre-fill
      history.push(captureState());
      lastCaptureRef.current = captureState();

      // Pre-fill no destructivo: solo campos vacíos
      let filledCount = 0;

      // ── Metadata fields ──
      if (!nit && data.nit) { setNit(data.nit); filledCount++; }
      if (!proveedorTexto && data.proveedorTexto) { setProveedorTexto(data.proveedorTexto); filledCount++; }
      if (!fechaDocumento && data.fechaDocumento) { setFechaDocumento(data.fechaDocumento); filledCount++; }
      if (montoTotal === '' && data.montoTotal !== null) { setMontoTotal(data.montoTotal.toString()); filledCount++; }
      if (!descripcion && data.descripcion) { setDescripcion(data.descripcion); filledCount++; }

      // ── Tipo de documento sugerido por IA ──
      if (!tipoDocumento && data.tipoDocumentoSugerido) {
        const validTypes = TIPO_OPTIONS.map((o) => o.value);
        if (validTypes.includes(data.tipoDocumentoSugerido as any)) {
          setTipoDocumento(data.tipoDocumentoSugerido as any);
          filledCount++;
          console.log(`[OCR] 📄 Tipo sugerido: "${data.tipoDocumentoSugerido}"`);
        } else {
          console.log(`[OCR] 📄 Tipo sugerido inválido: "${data.tipoDocumentoSugerido}"`);
        }
      }

      // ── Tercero: buscar coincidencia por proveedorTexto ──
      if (!terceroId && data.proveedorTexto && terceroOptions.length > 0) {
        const searchTerm = data.proveedorTexto.toLowerCase().trim();
        // Buscar tercero que contenga el texto extraído (o viceversa)
        const match = terceroOptions.find((opt) => {
          const label = (typeof opt === 'string' ? opt : opt.label || '').toLowerCase();
          return label.includes(searchTerm) || searchTerm.includes(label);
        });
        if (match) {
          const matchId = typeof match === 'string' ? match : match.value;
          setTerceroId(matchId);
          filledCount++;
          const matchLabel = typeof match === 'string' ? match : match.label;
          console.log(`[OCR] 👤 Tercero sugerido: "${matchLabel}" (${matchId})`);
        } else {
          console.log(`[OCR] 👤 No se encontró tercero para: "${data.proveedorTexto}"`);
        }
      }

      console.log(`[OCR] ✅ Pre-fill completado: ${filledCount} campos llenados`);
      setOcrState({ status: 'success', data });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setOcrState({ status: 'error', message: 'El servicio tardó demasiado. Intentá de nuevo.' });
      } else {
        setOcrState({ status: 'error', message: 'Error al extraer datos. Intentá de nuevo.' });
      }
    }
  }, [documento.storagePath, nit, proveedorTexto, fechaDocumento, montoTotal, descripcion, tipoDocumento, terceroId, terceroOptions, proyectoOptions, ocrErrorMessage]);

  const ocrLoading = ocrState.status === 'loading';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader
        title="Clasificar Documento"
        canGoBack={canGoBack}
        onBack={onBack}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto">
        {/* ── Preview ── */}
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
            {documento.mimeType?.startsWith('image/') ? (
              <img
                src={documento.url}
                alt={documento.fileName}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : documento.mimeType === 'application/pdf' ? (
              <PdfViewer fileUrl={documento.url} pageMode="single" className="w-full h-full" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <FileText size={32} />
                <span className="text-xs">Vista previa no disponible</span>
              </div>
            )}
            {/* Fallback message if image load fails */}
            {documento.mimeType?.startsWith('image/') && (
              <div className="hidden absolute inset-0 flex flex-col items-center justify-center text-slate-400">
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
          {/* Extraer con IA */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleOcrExtract}
              disabled={ocrLoading || saving}
              className={clsx(
                'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all',
                ocrLoading
                  ? 'bg-amber-200 text-amber-700 cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-500 text-amber-900',
              )}
            >
              {ocrLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Extrayendo...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Extraer con IA
                </>
              )}
            </button>
            {ocrState.status === 'error' && (
              <p className="text-[11px] text-rose-600 font-medium bg-rose-50 rounded-lg px-3 py-2">
                {ocrState.message}
              </p>
            )}
            {history.entries.length > 1 && (
              <div className="flex items-center justify-center gap-2 py-1">
                <button
                  type="button"
                  disabled={!history.canUndo}
                  onClick={handleUndo}
                  className={clsx(
                    'flex items-center gap-1 text-[11px] font-bold transition-colors',
                    history.canUndo ? 'text-slate-500 hover:text-slate-700' : 'text-slate-300 cursor-not-allowed',
                  )}
                >
                  ↩ Deshacer
                </button>
                <span className="text-[10px] text-slate-300">|</span>
                <button
                  type="button"
                  disabled={!history.canRedo}
                  onClick={handleRedo}
                  className={clsx(
                    'flex items-center gap-1 text-[11px] font-bold transition-colors',
                    history.canRedo ? 'text-slate-500 hover:text-slate-700' : 'text-slate-300 cursor-not-allowed',
                  )}
                >
                  Rehacer ↪
                </button>
              </div>
            )}
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

          {/* Fecha del Documento */}
          <div>
            <label htmlFor="fecha-documento" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Fecha del Documento <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="fecha-documento"
                type="date"
                value={fechaDocumento}
                onChange={(e) => setFechaDocumento(e.target.value)}
                onBlur={handleBlurCapture}
                disabled={saving}
                className={clsx(
                  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all',
                  saving && 'pointer-events-none opacity-50',
                )}
              />
              {fechaDocumento && (() => {
                const parts = fechaDocumento.split('-');
                const monthLabel = parts[1] === '01' ? 'Enero' : parts[1] === '02' ? 'Febrero' : parts[1] === '03' ? 'Marzo' : parts[1] === '04' ? 'Abril' : parts[1] === '05' ? 'Mayo' : parts[1] === '06' ? 'Junio' : parts[1] === '07' ? 'Julio' : parts[1] === '08' ? 'Agosto' : parts[1] === '09' ? 'Septiembre' : parts[1] === '10' ? 'Octubre' : parts[1] === '11' ? 'Noviembre' : parts[1] === '12' ? 'Diciembre' : '';
                return (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-indigo-500 font-medium pointer-events-none">
                    → {monthLabel} {parts[0]}
                  </span>
                );
              })()}
            </div>
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

          {/* Ejecuciones (optional, multi-select) — filtrado por tercero/proyecto */}
          <MultiSearchableSelect
            label="Ejecuciones (opcional)"
            values={ejecucionIds}
            onChange={setEjecucionIds}
            options={filteredEjecucionOptions}
            placeholder="Buscar ejecución..."
          />

          {/* Monto total — debajo de ejecuciones */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Monto total
            </label>
            <input
              type="number"
              value={montoTotal}
              onChange={(e) => setMontoTotal(e.target.value)}
              onBlur={handleBlurCapture}
              placeholder="0"
              disabled={saving}
              className={clsx(
                'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none transition-all',
                saving && 'pointer-events-none opacity-50',
              )}
            />
          </div>

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
                onBlur={handleBlurCapture}
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
                onBlur={handleBlurCapture}
                placeholder="Proveedor"
                list="tercero-suggestions"
                disabled={saving}
                className={clsx(
                  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none transition-all',
                  saving && 'pointer-events-none opacity-50',
                )}
              />
              <datalist id="tercero-suggestions">
                {terceroOptions.map((opt) => (
                  <option key={opt.value} value={opt.label} />
                ))}
              </datalist>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                onBlur={handleBlurCapture}
                placeholder="Descripción o notas extraídas del documento..."
                disabled={saving}
                rows={3}
                className={clsx(
                  'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none transition-all resize-none',
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
