'use client'

/* eslint-disable @next/next/no-img-element -- dynamic user-uploaded images */
import { useState } from 'react';
import { Comprobante } from '@/lib/types';
import { Upload, FileText, Download, Trash2, X } from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComprobantesViewer({ comprobantes, onDelete }: { comprobantes: Comprobante[]; onDelete?: (c: Comprobante) => void }) {
  const [modal, setModal] = useState<Comprobante | null>(null);

  if (!Array.isArray(comprobantes) || comprobantes.length === 0) return null;

  return (
    <>
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
        <Upload size={12} /> Comprobantes ({comprobantes.length})
      </p>
      <div className="space-y-2">
        {comprobantes.map(c => (
          <div key={c.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
            {c.type.startsWith('image/') ? (
              <img
                src={c.url}
                alt={c.name}
                className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                onClick={() => setModal(c)}
              />
            ) : (
              <button onClick={() => setModal(c)} className="shrink-0">
                <FileText size={22} className="text-slate-400 hover:text-indigo-600 transition-colors" />
              </button>
            )}
            <button className="flex-1 min-w-0 text-left" onClick={() => setModal(c)}>
              <p className="text-xs font-semibold text-slate-700 truncate">
                {c.descripcion || c.name}
                {c.tipo && <span className="ml-1.5 text-[9px] text-indigo-500 font-normal">({c.tipo})</span>}
              </p>
              <p className="text-[10px] text-slate-400">
                {c.type === 'application/pdf' ? 'PDF' : c.type === 'image/jpeg' ? 'JPG' : 'PNG'} &middot; {formatFileSize(c.size)}
                {c.uploadedAt && ` · ${new Date(c.uploadedAt).toLocaleDateString('es-CO')}`}
              </p>
            </button>
            <a href={c.url} target="_blank" rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0" title="Abrir en nueva pestaña">
              <Download size={16} />
            </a>
            {onDelete && (
              <button onClick={() => onDelete(c)}
                className="text-slate-300 hover:text-rose-500 transition-colors shrink-0" title="Eliminar comprobante">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal unificado para imágenes y PDFs */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 md:p-8" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{modal.descripcion || modal.name}</p>
                <p className="text-[10px] text-slate-400">
                  {modal.type === 'application/pdf' ? 'PDF' : modal.type === 'image/jpeg' ? 'JPG' : 'PNG'} &middot; {formatFileSize(modal.size)}
                  {modal.tipo && <span className="ml-2 text-indigo-500">({modal.tipo})</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a href={modal.url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all" title="Descargar">
                  <Download size={18} />
                </a>
                <button onClick={() => setModal(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100/50 flex items-center justify-center min-h-[300px]">
              {modal.type.startsWith('image/') ? (
                <img src={modal.url} alt={modal.name} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
              ) : (
                <iframe src={modal.url} className="w-full h-[70vh] rounded-lg" title={modal.name} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
