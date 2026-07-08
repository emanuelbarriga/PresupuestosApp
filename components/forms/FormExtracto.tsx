'use client';

import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Banco, ExtractoEstado } from '@/lib/types';
import { detectarBanco } from '@/lib/parsers/index';
import { runParsePipelineFromBuffer } from '@/lib/parsers/parsePipeline';
import { downloadPdfBytes } from '@/lib/downloadPdf';
import { BankConfirmModal } from '@/components/bancos/BankConfirmModal';

interface FormExtractoParseBtnProps {
  companyId: string;
  accountId: string;
  extractoId: string;
  /** URL for re-parsing existing extracts */
  pdfUrl?: string;
  /** File object when parsing from a freshly opened PDF (no network needed) */
  pdfFile?: File;
  storagePath?: string;
  estado: ExtractoEstado;
  onComplete?: () => void;
}

/**
 * "Parsear PDF" button.
 * - If a `pdfFile` is provided (new extract in Sidepanel), reads it directly.
 * - If only `pdfUrl` is provided (re-parse), downloads via Firebase SDK.
 * In both cases the pipeline receives an ArrayBuffer — no CORS issues.
 */
export function FormExtractoParseBtn({
  companyId,
  accountId,
  extractoId,
  pdfUrl,
  pdfFile,
  storagePath,
  estado,
  onComplete,
}: FormExtractoParseBtnProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [detectedBank, setDetectedBank] = useState<Banco>('No detectado');
  const [selectedBank, setSelectedBank] = useState<Banco>('No detectado');
  const [parsedBuffer, setParsedBuffer] = useState<ArrayBuffer | null>(null);

  const getBuffer = useCallback(async (): Promise<ArrayBuffer> => {
    if (pdfFile) {
      // Read from File directly — no network, no CORS
      return await pdfFile.arrayBuffer();
    }
    if (pdfUrl) {
      return await downloadPdfBytes(pdfUrl, storagePath);
    }
    throw new Error('No hay PDF disponible');
  }, [pdfFile, pdfUrl, storagePath]);

  const handleParseClick = useCallback(async () => {
    setLoading(true);
    try {
      const buffer = await getBuffer();

      // Extract text to detect bank
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const loadingTask = pdfjs.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: any) => item.str ?? '').join(' '));
      }
      const texto = pages.join('\n\n').trim();

      // Detect bank
      const banco = detectarBanco(texto);
      setDetectedBank(banco);
      setSelectedBank(banco);
      setParsedBuffer(buffer);
      setShowModal(true);
    } catch (err) {
      toast.error('Error al leer el PDF. Verificá que el archivo sea válido.');
    } finally {
      setLoading(false);
    }
  }, [getBuffer]);

  const handleConfirm = useCallback(async () => {
    if (!parsedBuffer) return;
    setLoading(true);
    setShowModal(false);

    try {
      const result = await runParsePipelineFromBuffer(
        companyId,
        accountId,
        extractoId,
        parsedBuffer,
        selectedBank,
      );

      if (result.success) {
        onComplete?.();
      } else {
        toast.error(`Error al parsear el extracto:\n${result.errores.join('\n')}`);
      }
    } catch (err) {
      toast.error('Error al ejecutar el pipeline de parseo.');
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId, extractoId, parsedBuffer, selectedBank, onComplete]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setDetectedBank('No detectado');
    setParsedBuffer(null);
  }, []);

  const isReparse = estado === 'Completado';

  const handleReparse = useCallback(() => {
    if (window.confirm('¿Estás seguro? Volver a parsear va a sobrescribir los movimientos existentes.')) {
      handleParseClick();
    }
  }, [handleParseClick]);

  // Don't show button for conciliated extracts
  if (estado === 'Conciliado') return null;

  return (
    <>
      <button
        onClick={isReparse ? handleReparse : handleParseClick}
        disabled={loading}
        className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:bg-indigo-200 disabled:text-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin" />
            Parseando...
          </>
        ) : (
          <>
            {isReparse ? 'Volver a parsear' : 'Parsear PDF'}
          </>
        )}
      </button>

      <BankConfirmModal
        open={showModal}
        detectedBank={detectedBank}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onBankChange={setSelectedBank}
      />
    </>
  );
}
