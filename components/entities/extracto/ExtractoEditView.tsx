'use client';

import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Banco, Month, MovimientoBancarioInput, ExtractoEstado, ExtractoBancario } from '@/lib/types';
import { MONTHS } from '@/lib/types';
import { parseForPreview } from '@/lib/parsers/parsePipeline';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { FileText, Upload, X, Eye, RefreshCw } from 'lucide-react';
import { downloadPdfBytes } from '@/lib/downloadPdf';
import { uploadFile } from '@/lib/fileUpload';

const ESTADOS_OPTS: { value: string; label: string }[] = [
  { value: 'Pendiente', label: 'Pendiente' },
  { value: 'En revisión', label: 'En revisión' },
  { value: 'Conciliado', label: 'Conciliado' },
  { value: 'Completado', label: 'Completado' },
  { value: 'Error de parseo', label: 'Error de parseo' },
];

interface ExtractoEditViewProps {
  companyId: string;
  record: ExtractoBancario;
  onSave: (data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}

export function ExtractoEditView({
  companyId,
  record,
  onSave,
}: ExtractoEditViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivoFile, setArchivoFile] = useState<File | null>(null);
  const [parseoLoading, setParseoLoading] = useState(false);
  const [preParseMovs, setPreParseMovs] = useState<MovimientoBancarioInput[] | null>(null);
  const [preParseSaldoFinal, setPreParseSaldoFinal] = useState<number | null>(null);

  // Local field state (replaces legacy onFieldChange/getField pattern)
  const [fields, setFields] = useState({
    mes: record?.mes ?? '',
    anio: String(record?.anio ?? new Date().getFullYear()),
    saldoInicial: String(record?.saldoInicial ?? ''),
    saldoFinal: String(record?.saldoFinal ?? ''),
    estado: record?.estado ?? 'Pendiente',
  });

  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const existingArchivo = record?.archivo;
  const currentArchivo = archivoFile
    ? { name: archivoFile.name }
    : existingArchivo;

  // File select
  const handlePdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande. Máximo 10MB.');
      return;
    }
    setArchivoFile(file);
    setPreParseMovs(null);
    setPreParseSaldoFinal(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeArchivo = () => {
    setArchivoFile(null);
    setPreParseMovs(null);
    setPreParseSaldoFinal(null);
  };

  // Parse new file
  const handleExtraerDatos = async () => {
    if (!archivoFile) return;
    setParseoLoading(true);
    try {
      const buffer = await archivoFile.arrayBuffer();
      const preview = await parseForPreview(buffer);

      setField('mes', preview.header.mes);
      setField('anio', String(preview.header.anio));
      setField('saldoInicial', String(preview.header.saldoInicial));
      setField('saldoFinal', String(preview.header.saldoFinal));
      setField('estado', 'Completado');

      setPreParseMovs(preview.movimientos);
      setPreParseSaldoFinal(preview.header.saldoFinal);

      toast.success(
        `Datos extraídos: ${preview.movimientos.length} movimientos, saldo inicial $${preview.header.saldoInicial.toLocaleString('es-CO')}`,
      );
    } catch (err) {
      toast.error('Error al leer el PDF. Verificá que el archivo sea válido.');
    } finally {
      setParseoLoading(false);
    }
  };

  // Re-parse existing
  const handleReparseExistente = async () => {
    if (!existingArchivo?.url) return;
    setParseoLoading(true);
    try {
      const buffer = await downloadPdfBytes(existingArchivo.url, existingArchivo.path);
      const preview = await parseForPreview(buffer);

      setField('mes', preview.header.mes);
      setField('anio', String(preview.header.anio));
      setField('saldoInicial', String(preview.header.saldoInicial));
      setField('saldoFinal', String(preview.header.saldoFinal));
      setField('estado', 'Completado');

      setPreParseMovs(preview.movimientos);
      setPreParseSaldoFinal(preview.header.saldoFinal);

      toast.success(
        `Re-parseado: ${preview.movimientos.length} movimientos, saldo final $${preview.header.saldoFinal.toLocaleString('es-CO')}`,
      );
    } catch (err) {
      toast.error('Error al re-parsear el PDF.');
    } finally {
      setParseoLoading(false);
    }
  };

  // Submit
  const handleSubmit = async () => {
    const data: Record<string, any> = {
      mes: fields.mes,
      anio: Number(fields.anio) || new Date().getFullYear(),
      saldoInicial: Number(fields.saldoInicial) || 0,
      saldoFinal: Number(fields.saldoFinal) || 0,
      estado: fields.estado,
    };

    if (archivoFile) {
      const uploadPath = `${companyId}/extractos/${crypto.randomUUID()}-${archivoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploadResult = await uploadFile(archivoFile, uploadPath);
      data.archivo = {
        url: uploadResult.url,
        path: uploadResult.path,
        name: archivoFile.name,
        uploadedAt: new Date().toISOString(),
      };
    }

    if (preParseMovs && preParseMovs.length > 0) {
      data._pendingMovimientos = preParseMovs;
      data._pendingSaldoFinal = preParseSaldoFinal;
    }

    await onSave(data);
  };

  return (
    <div className="space-y-5">
      <FormSelect
        label="Mes"
        value={fields.mes}
        onChange={(v) => setField('mes', v)}
        options={MONTHS.map((m) => ({ value: m, label: m }))}
      />
      <FormInput
        label="Año"
        value={fields.anio}
        onChange={(v) => setField('anio', v)}
        type="number"
      />
      <FormInput
        label="Saldo inicial"
        value={fields.saldoInicial}
        onChange={(v) => setField('saldoInicial', v)}
        type="number"
      />
      <FormInput
        label="Saldo final"
        value={fields.saldoFinal}
        onChange={(v) => setField('saldoFinal', v)}
        type="number"
      />
      <FormSelect
        label="Estado"
        value={fields.estado}
        onChange={(v) => setField('estado', v)}
        options={ESTADOS_OPTS}
      />

      {/* PDF section */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
          Extracto PDF
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handlePdfSelected}
          className="hidden"
        />
        {archivoFile || currentArchivo?.name ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-indigo-500 shrink-0" />
                <span className="text-xs text-indigo-700 truncate">
                  {archivoFile?.name ?? currentArchivo?.name ?? 'PDF'}
                </span>
                {preParseMovs && (
                  <span className="text-[9px] text-emerald-600 font-bold ml-1">
                    ✓ {preParseMovs.length} movs
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {existingArchivo?.url && !archivoFile && (
                  <a
                    href={existingArchivo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 transition-all"
                    title="Ver PDF"
                  >
                    <Eye size={14} />
                  </a>
                )}
                {existingArchivo?.url && !archivoFile && (
                  <button
                    onClick={handleReparseExistente}
                    disabled={parseoLoading}
                    className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-all disabled:opacity-50"
                    title="Volver a parsear el PDF existente"
                  >
                    {parseoLoading ? (
                      <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-amber-600 rounded-full animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                )}
                <button
                  onClick={archivoFile ? handleExtraerDatos : undefined}
                  disabled={parseoLoading || !archivoFile}
                  className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${
                    archivoFile
                      ? 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title={
                    archivoFile
                      ? 'Extraer datos del PDF'
                      : 'Seleccioná un PDF primero'
                  }
                >
                  {parseoLoading ? (
                    <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-indigo-600 rounded-full animate-spin" />
                  ) : (
                    <FileText size={14} />
                  )}
                </button>
                <button
                  onClick={removeArchivo}
                  className="p-1.5 rounded-lg text-indigo-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  title="Quitar archivo"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {!preParseMovs && !parseoLoading && (
              <p className="text-[10px] text-slate-400 italic text-center">
                Hacé click en el ícono de archivo para extraer los datos automáticamente
              </p>
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
          <p className="text-[10px] font-bold text-emerald-700 uppercase">
            ✓ Datos extraídos
          </p>
          <p className="text-xs text-emerald-600">
            {preParseMovs.length} movimientos — saldo final $
            {preParseSaldoFinal?.toLocaleString('es-CO')}
          </p>
          <p className="text-[9px] text-emerald-500 mt-1">
            Los movimientos se guardarán junto con el extracto
          </p>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={handleSubmit}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
