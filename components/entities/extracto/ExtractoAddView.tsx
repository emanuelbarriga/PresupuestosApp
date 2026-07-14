'use client';

import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Banco, MovimientoBancarioInput, CuentaBancaria } from '@/lib/types';
import { subscribeCuentasBancarias } from '@/lib/firestore';
import { parseForPreview } from '@/lib/parsers/parsePipeline';
import { extractPdfTextFromBuffer } from '@/lib/parsers/pdfText';
import { detectarBanco } from '@/lib/parsers/index';
import { Upload } from 'lucide-react';
import clsx from 'clsx';
import {
  ExtractoParseModal,
  type ExtractoParseHeader,
  type ExtractoParseProgress,
} from '@/components/bancos/ExtractoParseModal';
import { uploadFile } from '@/lib/fileUpload';

const MAX_EXTRACTO_SIZE = 10 * 1024 * 1024; // 10MB

interface ExtractoAddViewProps {
  companyId: string;
  accountId: string;
  onSave: (data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}

export function ExtractoAddView({
  companyId,
  accountId,
  onSave,
  onBack,
  onClose,
}: ExtractoAddViewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(accountId);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);

  useEffect(() => {
    const unsub = subscribeCuentasBancarias(companyId, setCuentas, () => {});
    return unsub;
  }, [companyId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<ExtractoParseProgress | null>(null);
  const [header, setHeader] = useState<ExtractoParseHeader | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoBancarioInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastBufferRef = useRef<Uint8Array | null>(null);

  const resetAll = () => {
    setModalOpen(false);
    setFile(null);
    setLoading(false);
    setProgress(null);
    setHeader(null);
    setMovimientos([]);
    setError(null);
    lastBufferRef.current = null;
  };

  const runParse = async (selected: File, bancoForzado?: Banco | null) => {
    setLoading(true);
    setError(null);
    setHeader(null);
    setMovimientos([]);
    setProgress(null);

    try {
      const buffer = await selected.arrayBuffer();
      // pdfjs TRANSFIERE el ArrayBuffer a un web worker vía postMessage,
      // lo que DETACHA el buffer. Creamos copias INDEPENDIENTES antes
      // de que nada toque el buffer original.
      // - copy1 → para extractPdfTextFromBuffer (inicial), se detachará
      // - copy2 → para parseForPreview (segundo extract), se detachará
      // - copy3 → Uint8Array para upload (NUNCA pasa por pdfjs)
      const copy1 = buffer.slice(0);
      const copy2 = buffer.slice(0);
      lastBufferRef.current = new Uint8Array(buffer.slice(0));

      const texto = await extractPdfTextFromBuffer(
        copy1,
        (current, total) => {
          setProgress({ stage: 'extrayendo', current, total });
        },
        'row-layout',
      );

      const bancoDetectado = bancoForzado ?? detectarBanco(texto);

      if (bancoDetectado === 'No detectado') {
        setError(
          'No se pudo detectar el banco automáticamente. Seleccioná uno manualmente.',
        );
        setHeader({
          mes: '',
          anio: new Date().getFullYear(),
          banco: 'No detectado',
          saldoInicial: 0,
          saldoFinal: 0,
        });
        setMovimientos([]);
        setLoading(false);
        return;
      }

      const preview = await parseForPreview(copy2, bancoDetectado);

      setHeader({
        mes: preview.header.mes,
        anio: preview.header.anio,
        banco: preview.detectedBanco,
        saldoInicial: preview.header.saldoInicial,
        saldoFinal: preview.header.saldoFinal,
      });
      setMovimientos(preview.movimientos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al parsear el extracto.');
    } finally {
      setLoading(false);
    }
  };

  const startParsing = async (selected: File) => {
    setFile(selected);
    setModalOpen(true);
    void runParse(selected);
  };

  const handleFiles = (fileList: FileList | null) => {
    const selected = fileList?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF.');
      return;
    }
    if (selected.size > MAX_EXTRACTO_SIZE) {
      toast.error('El archivo es demasiado grande. Máximo 10MB.');
      return;
    }
    void startParsing(selected);
  };

  const handleBancoCorregido = (nuevoBanco: Banco) => {
    if (!file) return;
    void runParse(file, nuevoBanco);
  };

  const handleGuardar = async (finalHeader: ExtractoParseHeader) => {
    setSaving(true);
    try {
      const data: Record<string, any> = {
        accountId: selectedAccountId,
        mes: finalHeader.mes,
        anio: finalHeader.anio,
        saldoInicial: finalHeader.saldoInicial,
        saldoFinal: finalHeader.saldoFinal,
        estado: 'Completado',
        uploadedAt: new Date().toISOString(),
      };

      if (file) {
        const uploadPath = `${companyId}/extractos/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        // Usar el buffer ya cargado en memoria en vez del File original
        // (evita problemas de Blob URL partitioning de Chrome con el objeto File)
        const pdfBytes = lastBufferRef.current!;
        const uploadResult = await uploadFile(pdfBytes, uploadPath);
        data.archivo = {
          url: uploadResult.url,
          path: uploadResult.path,
          name: file.name,
          uploadedAt: new Date().toISOString(),
        };
      }

      if (movimientos.length > 0) {
        data._pendingMovimientos = movimientos;
        data._pendingSaldoFinal = finalHeader.saldoFinal;
      }

      await onSave(data);
    } catch (err) {
      toast.error('Error al guardar el extracto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Account selector */}
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
        Cuenta bancaria
      </label>
      <select
        value={selectedAccountId}
        onChange={e => setSelectedAccountId(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white mb-4"
      >
        <option value="">Seleccioná una cuenta...</option>
        {cuentas.map(c => (
          <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>
        ))}
      </select>

      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
        Extracto PDF
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-10 transition-colors text-xs cursor-pointer text-center',
          isDragOver
            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
            : 'border-slate-300 hover:border-indigo-400 text-slate-500 hover:text-indigo-600',
        )}
      >
        <Upload size={22} />
        <p>Arrastrá el PDF del extracto acá o hacé click para seleccionarlo</p>
      </div>

      <ExtractoParseModal
        open={modalOpen}
        file={file}
        header={header}
        movimientos={movimientos}
        loading={loading}
        saving={saving}
        progress={progress}
        error={error}
        onBancoChange={handleBancoCorregido}
        onMovimientosChange={setMovimientos}
        onSave={handleGuardar}
        onCancel={resetAll}
      />
    </>
  );
}
