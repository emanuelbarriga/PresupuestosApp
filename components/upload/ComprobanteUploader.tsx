'use client'

/* eslint-disable @next/next/no-img-element -- dynamic user-uploaded images */
import { useState, useRef } from 'react';
import { Comprobante, SettingsItem } from '@/lib/types';
import { validateFile, deleteFile } from '@/lib/fileUpload';
import { Upload, FileText, Download, Trash2, X } from 'lucide-react';
import clsx from 'clsx';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PendingComprobante {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  descripcion?: string;
  tipo?: string;
}

interface ComprobanteUploaderProps {
  companyId: string;
  ejecucionId?: string;
  comprobantes: Comprobante[];
  onComprobantesChange: (updated: Comprobante[]) => void;
  pendingComprobantes: PendingComprobante[];
  onPendingChange: React.Dispatch<React.SetStateAction<PendingComprobante[]>>;
  tiposComprobante: SettingsItem[];
  requiredTypes?: string[];
  onSaveComprobantes?: (ejecucionId: string, comprobantes: Comprobante[]) => Promise<void>;
}

export function ComprobanteUploader({
  companyId,
  ejecucionId,
  comprobantes,
  onComprobantesChange,
  pendingComprobantes,
  onPendingChange,
  tiposComprobante,
  requiredTypes,
  onSaveComprobantes,
}: ComprobanteUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState('');
  const [newTipo, setNewTipo] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const applyTipoToPending = (tipo: string) => {
    setNewTipo(tipo);
    if (pendingComprobantes.length === 0) return;
    onPendingChange(prev => prev.map(p => ({ ...p, tipo: tipo || undefined })));
  };

  const applyDescToPending = (desc: string) => {
    setNewDesc(desc);
    if (pendingComprobantes.length === 0) return;
    onPendingChange(prev => prev.map(p => ({ ...p, descripcion: desc || undefined })));
  };

  const addFilesToList = (files: FileList | null) => {
    if (!files) return;
    setValidationError('');
    const newItems: PendingComprobante[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateFile(file);
      if (!validation.valid) {
        setValidationError(prev => prev ? `${prev}; ${file.name}: ${validation.error}` : `${file.name}: ${validation.error}`);
        continue;
      }
      newItems.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        descripcion: newDesc || undefined,
        tipo: newTipo || undefined,
      });
    }
    if (newItems.length > 0) {
      onPendingChange(prev => [...prev, ...newItems]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelected = (id: string) => {
    onPendingChange(prev => prev.filter(p => p.id !== id));
  };

  const handleRemove = async (comp: Comprobante) => {
    try {
      if (comp.path) {
        await deleteFile(comp.path);
      }
      const updated = comprobantes.filter(c => c.id !== comp.id);
      onComprobantesChange(updated);
      if (ejecucionId && onSaveComprobantes) {
        await onSaveComprobantes(ejecucionId, updated);
      }
    } catch (err) {
      // Error silencioso — el archivo se borró de la lista igual
    }
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
            <button key={t.name} type="button" onClick={() => applyTipoToPending(newTipo === t.name ? '' : t.name)}
              className={clsx("px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                newTipo === t.name ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                requiredTypes?.includes(t.name) && 'ring-1 ring-indigo-300')}>
              {t.name}{requiredTypes?.includes(t.name) ? ' *' : ''}
            </button>
          ))}
        </div>
      )}

      {/* 3) Descripción */}
      <input type="text" value={newDesc} onChange={e => applyDescToPending(e.target.value)}
        placeholder="Descripción del comprobante (opcional)"
        className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />

      {validationError && (
        <p className="text-[10px] text-rose-600 font-medium">{validationError}</p>
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

      {/* Pending / selected files list */}
      {pendingComprobantes.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-amber-500 uppercase">{pendingComprobantes.length} pendiente(s)</p>
          {pendingComprobantes.map(pc => (
            <div key={pc.id} className="flex items-center gap-2 bg-amber-50 rounded-lg p-2 border border-amber-200">
              <FileText size={16} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-amber-800 truncate">{pc.name}</p>
                <p className="text-[9px] text-amber-600">{formatFileSize(pc.size)}{pc.tipo ? <span className="ml-1.5 text-amber-700 font-medium">({pc.tipo})</span> : ''}</p>
              </div>
              <button onClick={() => removeSelected(pc.id)}
                className="text-amber-400 hover:text-rose-500 shrink-0" title="Quitar">
                <X size={12} />
              </button>
            </div>
          ))}
          <p className="text-[9px] text-amber-500 italic">Se subirán al guardar la ejecución</p>
        </div>
      )}
    </div>
  );
}
