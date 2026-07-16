import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PdfViewer } from '../PdfViewer';

// ─── Mock react-pdf ───────────────────────────────────────────────────────

let mockNumPages = 3;

vi.mock('react-pdf', () => ({
  Document: ({ children, file, onLoadSuccess }: any) => {
    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
      if (file && onLoadSuccess) {
        onLoadSuccess({ numPages: mockNumPages });
        setLoaded(true);
      }
    }, [file, onLoadSuccess]);

    if (!file) return null;
    // After load, render children so numPages-based rendering works
    return <div data-testid="pdf-document">{loaded ? children : null}</div>;
  },
  Page: ({ pageNumber }: any) => (
    <div data-testid={`pdf-page-${pageNumber}`}>Page {pageNumber}</div>
  ),
  pdfjs: {
    GlobalWorkerOptions: { workerSrc: '' },
  },
}));

vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}));
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}));

// ─── Tests ────────────────────────────────────────────────────────────────

describe('PdfViewer', () => {
  beforeEach(() => {
    mockNumPages = 3;
  });

  it('renders Document with react-pdf for a valid fileUrl', async () => {
    render(<PdfViewer fileUrl="https://example.com/doc.pdf" pageMode="single" />);
    await waitFor(() => {
      expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
    });
  });

  it('renders a single page when pageMode is single', async () => {
    render(<PdfViewer fileUrl="https://example.com/doc.pdf" pageMode="single" />);
    await waitFor(() => {
      expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument();
    });
  });

  it('renders all pages when pageMode is all', async () => {
    render(<PdfViewer fileUrl="https://example.com/doc.pdf" pageMode="all" />);
    await waitFor(() => {
      expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-page-2')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-page-3')).toBeInTheDocument();
    });
  });

  it('renders all pages respecting the actual numPages from onLoadSuccess', async () => {
    mockNumPages = 1;
    render(<PdfViewer fileUrl="https://example.com/doc.pdf" pageMode="all" />);
    await waitFor(() => {
      expect(screen.getByTestId('pdf-page-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('pdf-page-2')).not.toBeInTheDocument();
  });

  it('renders empty state when fileUrl is empty', () => {
    render(<PdfViewer fileUrl="" pageMode="single" />);
    expect(screen.getByText('Sin documento')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PdfViewer fileUrl="https://example.com/doc.pdf" pageMode="single" className="custom-class" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('custom-class');
  });
});
