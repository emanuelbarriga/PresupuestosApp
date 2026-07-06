/**
 * Script to extract plain text from PDF bank statements.
 * Run: node scripts/extract-pdf-text.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EJEMPLOS = resolve(__dirname, '..', 'datos', 'extractos', 'ejemplos');
const FIXTURES = resolve(__dirname, '..', 'lib', 'parsers', '__fixtures__');

const files = [
  { name: 'bancolombia', pdf: '82900017677_202602_4342786396.pdf' },
  { name: 'bancoomeva', pdf: 'Extracto Bancoomeva Enero  2026.pdf' },
  { name: 'global66', pdf: 'extracto_movimientos_start=01-05-2026_end=31-05-2026.pdf' },
];

async function extractText(pdfPath) {
  const buffer = readFileSync(pdfPath);
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data }).promise;
  let fullText = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

async function main() {
  for (const { name, pdf } of files) {
    const pdfPath = resolve(EJEMPLOS, pdf);
    console.log(`Extracting: ${name} (${pdf})...`);
    try {
      const text = await extractText(pdfPath);
      const outPath = resolve(FIXTURES, `${name}.txt`);
      writeFileSync(outPath, text, 'utf-8');
      console.log(`  ✅ ${name}.txt — ${text.length} chars`);
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
    }
  }
}

main().catch(console.error);
