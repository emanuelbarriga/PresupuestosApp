'use client';

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PdfViewerProps {
  fileUrl: string;
  pageMode: 'single' | 'all';
  className?: string;
}

export function PdfViewer({ fileUrl, pageMode, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);

  const onLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
  }, []);

  // ── Empty state ──
  if (!fileUrl) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center gap-2 text-slate-400 p-8',
          className,
        )}
      >
        <FileText size={32} />
        <span className="text-xs">Sin documento</span>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col items-center overflow-auto', className)}>
      <Document
        file={fileUrl}
        onLoadSuccess={onLoadSuccess}
        loading={
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs">Cargando PDF...</span>
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
            <FileText size={24} />
            <p className="text-xs text-center">No se pudo cargar el PDF</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink size={12} />
              Abrir en nueva pestaña
            </a>
          </div>
        }
      >
        {pageMode === 'single' ? (
          <Page pageNumber={1} />
        ) : (
          numPages != null &&
          Array.from({ length: numPages }, (_, i) => (
            <Page key={`page_${i + 1}`} pageNumber={i + 1} />
          ))
        )}
      </Document>
    </div>
  );
}
