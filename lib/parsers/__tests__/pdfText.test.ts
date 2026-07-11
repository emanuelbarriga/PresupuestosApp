import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdfjs-dist
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { extractPdfTextFromBuffer } from '@/lib/parsers/pdfText';

function mockPdf(pagesText: string[]) {
  return {
    promise: Promise.resolve({
      numPages: pagesText.length,
      getPage: vi.fn().mockImplementation((pageNum: number) =>
        Promise.resolve({
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ str: pagesText[pageNum - 1] }],
          }),
        }),
      ),
    }),
  };
}

describe('extractPdfTextFromBuffer', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('extracts and joins text from all pages', async () => {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockReturnValue(mockPdf(['Página uno', 'Página dos']));

    const { flat, rowLayout } = await extractPdfTextFromBuffer(new ArrayBuffer(10));

    expect(flat).toContain('Página uno');
    expect(flat).toContain('Página dos');
    expect(rowLayout).toContain('Página uno');
    expect(rowLayout).toContain('Página dos');
  });

  it('invokes onProgress once per page with (current, total)', async () => {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockReturnValue(mockPdf(['Uno', 'Dos', 'Tres']));

    const onProgress = vi.fn();
    await extractPdfTextFromBuffer(new ArrayBuffer(10), onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('reports total=1 for a single-page PDF', async () => {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockReturnValue(mockPdf(['Solo una página']));

    const onProgress = vi.fn();
    await extractPdfTextFromBuffer(new ArrayBuffer(10), onProgress);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it('throws when the PDF has no extractable text', async () => {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockReturnValue(mockPdf(['   ']));

    await expect(extractPdfTextFromBuffer(new ArrayBuffer(10))).rejects.toThrow(
      'PDF sin contenido de texto extraíble',
    );
  });

  it('works without an onProgress callback (optional param)', async () => {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjsModule.getDocument as any).mockReturnValue(mockPdf(['Texto sin progreso']));

    const { flat, rowLayout } = await extractPdfTextFromBuffer(new ArrayBuffer(10));
    expect(flat).toContain('Texto sin progreso');
    expect(rowLayout).toContain('Texto sin progreso');
  });
});
