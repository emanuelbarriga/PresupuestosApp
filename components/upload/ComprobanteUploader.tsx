'use client'

/* eslint-disable @next/next/no-img-element -- dynamic user-uploaded images */
import { useState, useRef, useMemo } from 'react';
import { Comprobante, SettingsItem } from '@/lib/types';
import { validateFile, uploadFileWithTask, generateMediaFilePath } from '@/lib/fileUpload';
import { createDocumento } from '@/lib/mediaService';
import { Upload, FileText, Download, Trash2, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadingFile {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'subiendo' | 'completado' | 'error';
  progress: number;
  error?: string;
  documentoId?: string;
  descripcion?: string;
  tipo?: string;
}

interface ComprobanteUploaderProps {
  companyId: string;
  ejecucionId?: string;
  comprobantes: Comprobante[];
  onComprobantesChange: (updated: Comprobante[]) => void;
  tiposComprobante: SettingsItem[];
  requiredTypes?: string[];
  /** Called when a file upload completes and a DocumentoMedio is created */
  onUploadComplete?: (documentoId: string) => void;
  /** Optional: overrides pending state tracking (legacy support) */
  pendingComprobantes?: Array<{ id: string; file: File; name: string; type: string; size: number; descripcion?: string; tipo?: string }>;
  onPendingChange?: React.Dispatch<React.SetStateAction<Array<{ id: string; file: File; name: string; type: string; size: number; descripcion?: string; tipo?: string }>>>;
  /** Called when comprobantes are saved (legacy, for EjecucionForm compatibility) */
  onSaveComprobantes?: (ejecucionId: string, comprobantes: Comprobante[]) => Promise<void>;
}

export function ComprobanteUploader({
  companyId,
  ejecucionId,
  comprobantes,
  onComprobantesChange,
  tiposComprobante,
  requiredTypes,
  onUploadComplete,
  onSaveComprobantes,
}: ComprobanteUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const activeUploads = useRef<Map<string, { cancel: () => void }>>(new Map());

  // If all existing comprobantes share the same tipo, pre-select that button
  const initialTipo = useMemo(() => {
    if (comprobantes.length === 0) return '';
    const tipos = [...new Set(comprobantes.map(c => c.tipo).filter(Boolean))];
    return tipos.length === 1 ? tipos[0] : '';
  }, [comprobantes]);
  const [newTipo, setNewTipo] = useState(initialTipo);
  const [newDesc, setNewDesc] = useState('');

  const addFilesToList = (files: FileList | null) => {
    if (!files) return;
    setValidationError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateFile(file);
      if (!validation.valid) {
        setValidationError(prev => prev ? `${prev}; ${file.name}: ${validation.error}` : `${file.name}: ${validation.error}`);
        continue;
      }

      const uploadId = crypto.randomUUID();
      const uploadEntry: UploadingFile = {
        id: uploadId,
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'subiendo',
        progress: 0,
        descripcion: newDesc || undefined,
        tipo: newTipo || undefined,
      };
      setUploadingFiles(prev => [...prev, uploadEntry]);

      // Start upload immediately
      startUpload(uploadId, file, companyId, newDesc || undefined, newTipo || undefined);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startUpload = async (
    uploadId: string,
    file: File,
    cId: string,
    descripcion?: string,
    tipo?: string,
  ) => {
    const storagePath = generateMediaFilePath(cId, file.name);

    const onProgress = (progress: number) => {
      setUploadingFiles(prev =>
        prev.map(f => f.id === uploadId ? { ...f, progress: Math.min(progress, 99) } : f),
      );
    };

    try {
      const { promise: uploadPromise, task } = uploadFileWithTask(file, storagePath, onProgress);

      // Track for cancellation
      activeUploads.current.set(uploadId, { cancel: () => task.cancel() });

      const uploadResult = await uploadPromise;

      // Update progress to 100%
      setUploadingFiles(prev =>
        prev.map(f => f.id === uploadId ? { ...f, progress: 100 } : f),
      );

      // Create DocumentoMedio in Firestore
      const userId = 'current'; // Will be replaced with auth UID
      const docId = await createDocumento(
        cId,
        {
          fileName: file.name,
          storagePath: uploadResult.path,
          url: uploadResult.url,
          size: file.size,
          mimeType: file.type,
          status: 'por_clasificar',
          ejecucionIds: [],
          _source: 'ejecucion-form',
          createdBy: userId,
        },
        userId,
        'ejecucion-form',
      );

      // Mark as completed
      setUploadingFiles(prev =>
        prev.map(f => f.id === uploadId ? { ...f, status: 'completado', documentoId: docId } : f),
      );

      // Notify parent
      onUploadComplete?.(docId);

      // Clean up completed uploads after a delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
      }, 3000);

    } catch (err) {
      if (err instanceof Error && err.message === 'canceled') return;
      setUploadingFiles(prev =>
        prev.map(f => f.id === uploadId ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Error' } : f),
      );
    } finally {
      activeUploads.current.delete(uploadId);
    }
  };

  const cancelUpload = (uploadId: string) => {
    activeUploads.current.get(uploadId)?.cancel();
    setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
  };

  const handleRemove = async (comp: Comprobante) => {
    try {
      const { deleteFile } = await import('@/lib/fileUpload');
      if (comp.path) {
        await deleteFile(comp.path);
      }
      const updated = comprobantes.filter(c => c.id !== comp.id);
      onComprobantesChange(updated);
      if (ejecucionId && onSaveComprobantes) {
        await onSaveComprobantes(ejecucionId, updated);
      }
    } catch {
      // Error silencioso — el archivo se borró de la lista igual
    }
  };

  const applyTipoToNew = (tipo: string) => {
    setNewTipo(tipo);
  };

  return (
    <div className="space-y-2">
      {/* 1) File picker */}
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple
        onChange={e => { addFilesToList(e.target.files); }} className="hidden" />
      <button onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors">
        <Upload size={14} /> Seleccionar archivos
      </button>

      {/* 2) Tipo buttons */}
      {tiposComprobante.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {tiposComprobante.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(t => (
            <button key={t.name} type="button" onClick={() => applyTipoToNew(newTipo === t.name ? '' : t.name)}
              className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                newTipo === t.name ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                requiredTypes?.includes(t.name) && 'ring-1 ring-indigo-300')}>
              {t.name}{requiredTypes?.includes(t.name) ? ' *' : ''}
            </button>
          ))}
        </div>
      )}

      {/* 3) Descripción */}
      <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
        placeholder="Descripción del comprobante (opcional)"
        className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />

      {validationError && (
        <p className="text-[10px] text-rose-600 font-medium">{validationError}</p>
      )}

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-indigo-500 uppercase">
            {uploadingFiles.filter(f => f.status === 'subiendo').length} subiendo...
          </p>
          {uploadingFiles.map(uf => (
            <div key={uf.id} className={clsx(
              'flex items-center gap-2 rounded-lg p-2 border',
              uf.status === 'subiendo' && 'bg-indigo-50 border-indigo-200',
              uf.status === 'completado' && 'bg-emerald-50 border-emerald-200',
              uf.status === 'error' && 'bg-rose-50 border-rose-200',
            )}>
              {uf.status === 'subiendo' && <Loader2 size={14} className="text-indigo-500 animate-spin shrink-0" />}
              {uf.status === 'completado' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
              {uf.status === 'error' && <AlertCircle size={14} className="text-rose-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-slate-700 truncate">{uf.name}</p>
                <p className="text-[9px] text-slate-500">
                  {uf.status === 'subiendo' && `${Math.round(uf.progress)}%`}
                  {uf.status === 'completado' && 'Subido'}
                  {uf.status === 'error' && (uf.error || 'Error')}
                </p>
              </div>
              {uf.status === 'subiendo' && (
                <button onClick={() => cancelUpload(uf.id)}
                  className="text-indigo-400 hover:text-rose-500 shrink-0" title="Cancelar">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Existing comprobantes */}
      {comprobantes.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase">{comprobantes.length} comprobante(s) guardado(s)</p>
          {comprobantes.map(c => (
            <div key={c.id} className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2 border border-emerald-200">
              {c.type.startsWith('image/') ? (
                <img src={c.url} alt={c.name} className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <FileText size={16} className="text-emerald-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-emerald-800 truncate">{c.descripcion || c.name}</p>
                <p className="text-[9px] text-emerald-600">{formatFileSize(c.size)}{c.tipo && <span className="ml-1.5 text-emerald-700 font-medium">({c.tipo})</span>}</p>
              </div>
              <a href={c.url} target="_blank" rel="noopener noreferrer"
                className="text-emerald-400 hover:text-indigo-600 shrink-0" title="Descargar">
                <Download size={12} />
              </a>
              {ejecucionId && (
                <button onClick={() => handleRemove(c)} className="text-emerald-400 hover:text-rose-500 shrink-0" title="Eliminar">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
