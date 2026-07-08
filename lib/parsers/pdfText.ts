export type PdfProgressCallback = (current: number, total: number) => void;

type ExtractMode = 'flat' | 'row-layout';

/**
 * Extract plain text content from every page of a PDF ArrayBuffer using pdfjs-dist.
 *
 * @param buffer PDF content as ArrayBuffer (from a File or a download)
 * @param onProgress optional callback invoked after each page is extracted, as (current, total)
 * @param mode 'flat' (default): join all page items with spaces (one line per page)
 *              'row-layout': group items by Y position, one line per visual row
 * @throws if the PDF has no extractable text content
 */
export async function extractPdfTextFromBuffer(
  buffer: ArrayBuffer,
  onProgress?: PdfProgressCallback,
  mode: ExtractMode = 'flat',
): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let pageText: string;
    if (mode === 'row-layout') {
      // Group items by Y position so columnar PDFs produce row-by-row text
      const rows = new Map<number, Array<{ str: string; x: number }>>();
      for (const item of content.items) {
        const str = (item as any).str ?? '';
        if (!str) continue;
        const x = (item as any).transform?.[4] ?? 0;
        const y = Math.round(((item as any).transform?.[5] ?? 0) / 5) * 5;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ str, x });
      }
      const sortedY = [...rows.keys()].sort((a, b) => b - a);
      pageText = sortedY
        .map(y => rows.get(y)!.sort((a, b) => a.x - b.x).map(i => i.str).join(' '))
        .join('\n');
    } else {
      // Flat: join all items with spaces (one line per page)
      pageText = content.items
        .map((item: any) => item.str ?? '')
        .join(' ');
    }
    pages.push(pageText);
    onProgress?.(i, pdf.numPages);
  }

  const texto = pages.join('\n\n').trim();
  if (!texto) {
    throw new Error('PDF sin contenido de texto extraíble');
  }
  return texto;
}
