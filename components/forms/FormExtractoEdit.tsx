'use client';

import React, { useState, useRef } from 'react';
import type { Banco, Month, MovimientoBancarioInput, ExtractoEstado } from '@/lib/types';
import { MONTHS } from '@/lib/types';
import { parseForPreview } from '@/lib/parsers/parsePipeline';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { FileText, Upload, X, Eye, RefreshCw } from 'lucide-react';
import { downloadPdfBytes } from '@/lib/downloadPdf';
import { uploadFile } from '@/lib/fileUpload';

/**
 * FormExtractoEdit — edit-mode form for ExtractoBancario records.
 *
 * Extracted from Sidepanel.tsx :1509-1700 to fix the hook-order violation:
 * hooks were declared conditionally inside an `if (ft === 'extracto')` block.
 * This component's hooks are UNCONDITIONAL (always rendered), satisfying
 * React's Rules of Hooks.
 *
 * Only handles `mode === 'edit'`. The "add" flow uses `ExtractoAddForm`.
 */

interface FormExtractoEditProps {
  form: { mode: 'edit'; type: 'extracto'; record: { id: string; mes?: string; anio?: number; saldoInicial?: number; saldoFinal?: number; estado?: string; archivo?: { url: string; name: string; path?: string }; uploadedAt?: string } };
  companyId: string;
  title: string;
  onSubmit: (form: any, data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
  /** set is a helper to update the parent fields state (passed in from FormPanel) */
  onFieldChange: (key: string, value: string) => void;
  /** get field value from parent fields state */
  getField: (key: string) => string;
}

export function FormExtractoEdit({
  form,
  companyId,
  title,
  onSubmit,
  onBack,
  onClose,
  saving: externalSaving,
  onFieldChange,
  getField,
}: FormExtractoEditProps) {
  // ── Unconditional hooks (always rendered, fixes hook-order violation) ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [parseoLoading, setParseoLoading] = useState(false);
  const [preParseMovs, setPreParseMovs] = useState<MovimientoBancarioInput[] | null>(null);
  const [preParseSaldoFinal, setPreParseSaldoFinal] = useState<number | null>(null);

  const extractoRecord = form.record;
  const existingArchivo = extractoRecord?.archivo;
  const archivoEnFields = getField('_archivoUploaded') ? (() => { try { return JSON.parse(getField('_archivoUploaded')); } catch { return null; } })() : null;
  const currentArchivo = archivoEnFields || existingArchivo;

  // ── File select ──
  const handlePdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se permiten archivos PDF.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('El archivo es demasiado grande. Máximo 10MB.'); return; }
    setArchivoFile(file);
    onFieldChange('_archivoPendiente', JSON.stringify({ name: file.name }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeArchivo = () => {
    setArchivoFile(null);
    setPreParseMovs(null);
    setPreParseSaldoFinal(null);
    onFieldChange('_archivoPendiente', '');
    onFieldChange('_archivoUploaded', '');
  };

  // ── Parse new file using parseForPreview ──
  const handleExtraerDatos = async () => {
    if (!archivoFile) return;
    setParseoLoading(true);
    try {
      const buffer = await archivoFile.arrayBuffer();
      const preview = await parseForPreview(buffer);

      // Auto-fill form fields
      onFieldChange('mes', preview.header.mes);
      onFieldChange('anio', String(preview.header.anio));
      onFieldChange('saldoInicial', String(preview.header.saldoInicial));
      onFieldChange('saldoFinal', String(preview.header.saldoFinal));
      onFieldChange('estado', 'Completado');

      setPreParseMovs(preview.movimientos);
      setPreParseSaldoFinal(preview.header.saldoFinal);

      alert(`Datos extraídos: ${preview.movimientos.length} movimientos, saldo inicial $${preview.header.saldoInicial.toLocaleString('es-CO')}`);
    } catch (err) {
      alert('Error al leer el PDF. Verificá que el archivo sea válido.');
    } finally {
      setParseoLoading(false);
    }
  };

  // ── Re-parse existing extracto ──
  const handleReparseExistente = async () => {
    if (!currentArchivo?.url) return;
    setParseoLoading(true);
    try {
      const buffer = await downloadPdfBytes(currentArchivo.url, currentArchivo.path);
      const preview = await parseForPreview(buffer);

      onFieldChange('mes', preview.header.mes);
      onFieldChange('anio', String(preview.header.anio));
      onFieldChange('saldoInicial', String(preview.header.saldoInicial));
      onFieldChange('saldoFinal', String(preview.header.saldoFinal));
      onFieldChange('estado', 'Completado');

      setPreParseMovs(preview.movimientos);
      setPreParseSaldoFinal(preview.header.saldoFinal);

      alert(`Re-parseado: ${preview.movimientos.length} movimientos, saldo final $${preview.header.saldoFinal.toLocaleString('es-CO')}`);
    } catch (err) {
      alert('Error al re-parsear el PDF.');
    } finally {
      setParseoLoading(false);
    }
  };

  // ── Submit ──
  const handleExtractoSubmit = async () => {
    // Use onSubmit directly — the parent FormPanel handles the data assembly
    // through onFieldChange/getField. We pass a submit handler that reads
    // all fields via getField.
    const data: Record<string, any> = {};
    data.mes = getField('mes');
    data.anio = Number(getField('anio')) || new Date().getFullYear();
    data.saldoInicial = Number(getField('saldoInicial')) || 0;
    data.saldoFinal = Number(getField('saldoFinal')) || 0;
    data.estado = getField('estado');
    data._archivoUploaded = getField('_archivoUploaded');
    data._archivoPendiente = getField('_archivoPendiente');

    if (data._archivoUploaded) {
      try { data.archivo = JSON.parse(data._archivoUploaded); } catch {}
      delete data._archivoUploaded;
    }
    delete data._archivoPendiente;

    if (archivoFile) {
      const uploadPath = `${companyId}/extractos/${crypto.randomUUID()}-${archivoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploadResult = await uploadFile(archivoFile, uploadPath);
      data.archivo = { url: uploadResult.url, path: uploadResult.path, name: archivoFile.name, uploadedAt: new Date().toISOString() };
    }

    if (preParseMovs && preParseMovs.length > 0) {
      data._pendingMovimientos = preParseMovs;
      data._pendingSaldoFinal = preParseSaldoFinal;
    }

    await onSubmit(form, data);
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <FormSelect label="Mes" value={getField('mes')} onChange={v => onFieldChange('mes', v)}
          options={MONTHS.map(m => ({ value: m, label: m }))} />
        <FormInput label="Año" value={getField('anio')} onChange={v => onFieldChange('anio', v)} type="number" />
        <FormInput label="Saldo inicial" value={getField('saldoInicial')} onChange={v => onFieldChange('saldoInicial', v)} type="number" />
        <FormInput label="Saldo final" value={getField('saldoFinal')} onChange={v => onFieldChange('saldoFinal', v)} type="number" />
        <FormSelect label="Estado" value={getField('estado')} onChange={v => onFieldChange('estado', v)}
          options={[
            { value: 'Pendiente', label: 'Pendiente' },
            { value: 'En revisión', label: 'En revisión' },
            { value: 'Conciliado', label: 'Conciliado' },
            { value: 'Completado', label: 'Completado' },
            { value: 'Error de parseo', label: 'Error de parseo' },
          ]} />

        {/* PDF: select + parse + auto-fill */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Extracto PDF</label>
          <input ref={fileInputRef} type="file" accept=".pdf"
            onChange={handlePdfSelected} className="hidden" />
          {archivoFile || (currentArchivo?.url || getField('_archivoUploaded')) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-indigo-500 shrink-0" />
                  <span className="text-xs text-indigo-700 truncate">{archivoFile?.name ?? currentArchivo?.name ?? 'PDF'}</span>
                  {preParseMovs && <span className="text-[9px] text-emerald-600 font-bold ml-1">✓ {preParseMovs.length} movs</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {currentArchivo?.url && !archivoFile && (
                    <a href={currentArchivo.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 transition-all" title="Ver PDF">
                      <Eye size={14} />
                    </a>
                  )}
                  {currentArchivo?.url && !archivoFile && (
                    <button onClick={handleReparseExistente} disabled={parseoLoading}
                      className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-all disabled:opacity-50" title="Volver a parsear el PDF existente">
                      {parseoLoading
                        ? <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-amber-600 rounded-full animate-spin" />
                        : <RefreshCw size={14} />
                      }
                    </button>
                  )}
                  <button onClick={archivoFile ? handleExtraerDatos : undefined} disabled={parseoLoading || !archivoFile}
                    className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${
                      archivoFile ? 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100' : 'text-slate-300 cursor-not-allowed'
                    }`} title={archivoFile ? 'Extraer datos del PDF' : 'Seleccioná un PDF primero'}>
                    {parseoLoading
                      ? <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-indigo-600 rounded-full animate-spin" />
                      : <FileText size={14} />
                    }
                  </button>
                  <button onClick={removeArchivo}
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Quitar archivo">
                    <X size={14} />
                  </button>
                </div>
              </div>
              {!preParseMovs && !parseoLoading && (
                <p className="text-[10px] text-slate-400 italic text-center">Hacé click en el ícono de archivo para extraer los datos automáticamente</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-3 transition-colors text-xs text-slate-500 hover:text-indigo-600"
            >
              <Upload size={14} /> Seleccionar PDF del extracto
            </button>
          )}
        </div>

        {preParseMovs && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            <p className="text-[10px] font-bold text-emerald-700 uppercase">✓ Datos extraídos</p>
            <p className="text-xs text-emerald-600">{preParseMovs.length} movimientos — saldo final ${preParseSaldoFinal?.toLocaleString('es-CO')}</p>
            <p className="text-[9px] text-emerald-500 mt-1">Los movimientos se guardarán junto con el extracto</p>
          </div>
        )}
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleExtractoSubmit} disabled={externalSaving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {externalSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
