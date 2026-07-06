import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FormExtractoParseBtn } from '@/components/forms/FormExtracto';
import type { Banco } from '@/lib/types';

// Mock pdfjs-dist
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'bancolombia.com Extracto' }],
        }),
      }),
    }),
  }),
}));

// Mock detectarBanco
vi.mock('@/lib/parsers/index', () => ({
  detectarBanco: vi.fn().mockReturnValue('Bancolombia'),
}));

// Mock runParsePipeline
vi.mock('@/lib/parsers/parsePipeline', () => ({
  runParsePipeline: vi.fn().mockResolvedValue({
    success: true,
    totalMovimientos: 10,
    errores: [],
    requiereRevision: 0,
    duplicados: 0,
  }),
}));

import { detectarBanco } from '@/lib/parsers/index';
import { runParsePipeline } from '@/lib/parsers/parsePipeline';

describe('FormExtractoParseBtn', () => {
  const defaultProps = {
    companyId: 'company-1',
    accountId: 'account-1',
    extractoId: 'extracto-1',
    pdfUrl: 'https://example.com/extracto.pdf',
    estado: 'Pendiente' as const,
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Parsear PDF" button when estado is Pendiente', () => {
    render(<FormExtractoParseBtn {...defaultProps} />);
    expect(screen.getByText('Parsear PDF')).toBeInTheDocument();
  });

  it('shows "Volver a parsear" button when estado is Completado', () => {
    render(<FormExtractoParseBtn {...defaultProps} estado="Completado" />);
    expect(screen.getByText('Volver a parsear')).toBeInTheDocument();
  });

  it('does not render when estado is Conciliado', () => {
    const { container } = render(<FormExtractoParseBtn {...defaultProps} estado="Conciliado" />);
    expect(container.textContent).toBe('');
  });

  it('shows bank confirmation modal when clicked', async () => {
    render(<FormExtractoParseBtn {...defaultProps} />);

    fireEvent.click(screen.getByText('Parsear PDF'));

    await waitFor(() => {
      expect(screen.getByText(/Se detectó/)).toBeInTheDocument();
    });
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
  });

  it('runs pipeline when bank is confirmed', async () => {
    render(<FormExtractoParseBtn {...defaultProps} />);

    // Click button to trigger text extraction
    fireEvent.click(screen.getByText('Parsear PDF'));

    // Wait for modal
    await waitFor(() => {
      expect(screen.getByText('Parsear')).toBeInTheDocument();
    });

    // Click Parsear to confirm
    fireEvent.click(screen.getByText('Parsear'));

    await waitFor(() => {
      expect(runParsePipeline).toHaveBeenCalledWith(
        'company-1',
        'account-1',
        'extracto-1',
        'https://example.com/extracto.pdf',
        'Bancolombia',
      );
    });
  });

  it('shows loading state while parsing', async () => {
    // Make pipeline resolve slowly
    vi.mocked(runParsePipeline).mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        success: true, totalMovimientos: 10, errores: [], requiereRevision: 0, duplicados: 0,
      }), 500))
    );

    render(<FormExtractoParseBtn {...defaultProps} />);

    fireEvent.click(screen.getByText('Parsear PDF'));

    await waitFor(() => {
      expect(screen.getByText('Parsear')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Parsear'));

    await waitFor(() => {
      expect(screen.getByText('Parseando...')).toBeInTheDocument();
    });
  });

  it('calls onComplete after successful parse', async () => {
    const onComplete = vi.fn();
    render(<FormExtractoParseBtn {...defaultProps} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Parsear PDF'));

    await waitFor(() => {
      expect(screen.getByText('Parsear')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Parsear'));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
