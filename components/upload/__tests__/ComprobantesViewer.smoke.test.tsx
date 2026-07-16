import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ComprobantesViewer } from '../ComprobantesViewer';
import { Comprobante } from '@/lib/types';

// Mock PdfViewer (used in modal for PDF preview)
vi.mock('react-pdf', () => ({
  Document: ({ children, file }: any) => {
    if (!file) return null;
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: any) => <div data-testid={`pdf-page-${pageNumber}`} />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}));
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}));

const mockComprobantes: Comprobante[] = [
  {
    id: 'comp-1',
    name: 'factura.pdf',
    url: 'https://example.com/factura.pdf',
    type: 'application/pdf',
    size: 1024,
    path: 'some/path/factura.pdf',
    descripcion: 'Factura de prueba',
    uploadedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'comp-2',
    name: 'recibo.jpg',
    url: 'https://example.com/recibo.jpg',
    type: 'image/jpeg',
    size: 2048,
    path: 'some/path/recibo.jpg',
    uploadedAt: '2026-01-16T00:00:00.000Z',
  },
];

describe('ComprobantesViewer', () => {
  it('renderiza null cuando comprobantes está vacío', () => {
    const { container } = render(<ComprobantesViewer comprobantes={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renderiza null cuando comprobantes no es un array', () => {
    const { container } = render(<ComprobantesViewer comprobantes={null as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('muestra la cantidad de comprobantes', () => {
    render(<ComprobantesViewer comprobantes={mockComprobantes} />);
    expect(screen.getByText(/Comprobantes \(2\)/)).toBeInTheDocument();
  });

  it('muestra el nombre del comprobante', () => {
    render(<ComprobantesViewer comprobantes={mockComprobantes} />);
    expect(screen.getByText('Factura de prueba')).toBeInTheDocument();
  });

  it('no renderiza botón de eliminar si no hay onDelete', () => {
    render(<ComprobantesViewer comprobantes={mockComprobantes} />);
    expect(screen.queryByTitle('Eliminar comprobante')).not.toBeInTheDocument();
  });

  it('renderiza botones de eliminar si hay onDelete', () => {
    render(<ComprobantesViewer comprobantes={mockComprobantes} onDelete={vi.fn()} />);
    expect(screen.getAllByTitle('Eliminar comprobante')).toHaveLength(2);
  });
});
