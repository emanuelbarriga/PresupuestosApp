export type PdfProgressCallback = (current: number, total: number) => void;

/**
 * Extract plain text content from every page of a PDF ArrayBuffer using pdfjs-dist.
 *
 * @param buffer PDF content as ArrayBuffer (from a File or a download)
 * @param onProgress optional callback invoked after each page is extracted, as (current, total)
 * @throws if the PDF has no extractable text content
 */
export async function extractPdfTextFromBuffer(
  buffer: ArrayBuffer,
  onProgress?: PdfProgressCallback,
): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    pages.push(pageText);
    onProgress?.(i, pdf.numPages);
  }

  const texto = pages.join('\n\n').trim();
  if (!texto) {
    throw new Error('PDF sin contenido de texto extraíble');
  }
  return texto;
}
