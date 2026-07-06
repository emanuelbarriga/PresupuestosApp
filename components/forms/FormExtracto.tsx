'use client';

import React, { useState, useCallback } from 'react';
import type { Banco, ExtractoEstado } from '@/lib/types';
import { detectarBanco } from '@/lib/parsers/index';
import { runParsePipeline } from '@/lib/parsers/parsePipeline';
import { downloadPdfBytes } from '@/lib/downloadPdf';
import { BankConfirmModal } from '@/components/bancos/BankConfirmModal';

interface FormExtractoParseBtnProps {
  companyId: string;
  accountId: string;
  extractoId: string;
  pdfUrl: string;
  storagePath?: string;
  estado: ExtractoEstado;
  onComplete?: () => void;
}

/**
 * "Parsear PDF" button that appears after an extracto is saved with archivo.url set.
 * Handles the full flow: extract text → detect bank → confirm modal → run pipeline.
 */
export function FormExtractoParseBtn({
  companyId,
  accountId,
  extractoId,
  pdfUrl,
  storagePath,
  estado,
  onComplete,
}: FormExtractoParseBtnProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [detectedBank, setDetectedBank] = useState<Banco>('No detectado');
  const [selectedBank, setSelectedBank] = useState<Banco>('No detectado');

  const handleParseClick = useCallback(async () => {
    setLoading(true);
    try {
      // Extract PDF text using pdfjs-dist — download via Firebase SDK (no CORS issues)
      const arrayBuffer = await downloadPdfBytes(pdfUrl, storagePath);

      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
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
      setShowModal(true);
    } catch (err) {
      console.error('Error extracting PDF text:', err);
      alert('Error al leer el PDF. Verificá que el archivo sea válido.');
    } finally {
      setLoading(false);
    }
  }, [pdfUrl, storagePath]);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setShowModal(false);

    try {
      const result = await runParsePipeline(
        companyId,
        accountId,
        extractoId,
        pdfUrl,
        selectedBank,
        storagePath,
      );

      if (result.success) {
        onComplete?.();
      } else {
        alert(`Error al parsear el extracto:\n${result.errores.join('\n')}`);
      }
    } catch (err) {
      console.error('Error running parse pipeline:', err);
      alert('Error al ejecutar el pipeline de parseo.');
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId, extractoId, pdfUrl, selectedBank, storagePath, onComplete]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setDetectedBank('No detectado');
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
