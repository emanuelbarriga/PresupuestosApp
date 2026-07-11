export type PdfProgressCallback = (current: number, total: number) => void;

/**
 * Extract flat and row-layout text from a PDF in a single pass.
 *
 * @param buffer PDF content as ArrayBuffer (from a File or a download)
 * @param onProgress optional callback invoked after each page is extracted, as (current, total)
 * @throws if the PDF has no extractable text content
 */
export async function extractPdfTextFromBuffer(
  buffer: ArrayBuffer,
  onProgress?: PdfProgressCallback,
): Promise<{ flat: string; rowLayout: string }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Configurar worker en browser (tests usan entorno Node, no necesitan worker)
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  const flatPages: string[] = [];
  const rowPages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Flat: join all items with spaces (one line per page)
    flatPages.push(
      content.items.map((item: any) => item.str ?? '').join(' '),
    );

    // Row-layout: group items by Y position so columnar PDFs produce row-by-row text
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
    rowPages.push(
      sortedY
        .map(y => rows.get(y)!.sort((a, b) => a.x - b.x).map(i => i.str).join(' '))
        .join('\n'),
    );

    onProgress?.(i, pdf.numPages);
  }

  const flat = flatPages.join('\n\n').trim();
  const rowLayout = rowPages.join('\n\n').trim();

  if (!flat && !rowLayout) {
    throw new Error('PDF sin contenido de texto extraíble');
  }

  return { flat, rowLayout };
}
