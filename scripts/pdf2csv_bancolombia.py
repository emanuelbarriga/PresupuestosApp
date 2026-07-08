#!/usr/bin/env python3
"""
Convertir extractos PDF Bancolombia a CSV.

Uso: python3 scripts/pdf2csv_bancolombia.py [archivo.pdf ...]
     python3 scripts/pdf2csv_bancolombia.py datos/Extractos/Bancolombia\ 7776/

Si se pasa un directorio, procesa todos los PDFs que contengan.
El CSV se genera en la misma carpeta con extensión .csv
"""
import re
import sys
import os
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("Instalá pypdf: pip3 install pypdf", file=sys.stderr)
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────
MONTHS_ES = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

# ── PDF text extraction (same logic as browser pdfjs) ─────────────────────
def extract_text(pdf_path: str) -> str:
    """Return all text from PDF, one long line per page, pages separated by \n\n."""
    reader = PdfReader(pdf_path)
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text(extraction_mode="layout")
        # Collapse newlines within page into spaces (same as pdfjs join(' '))
        text = re.sub(r'\s+', ' ', text).strip()
        pages.append(text)
    return '\n\n'.join(pages)


# ── Parser (Bancolombia-specific) ─────────────────────────────────────────
def parse_monto(text: str) -> float:
    """
    Parse number from either pypdf or pdfjs extraction.
    
    pypdf produce: '37,016,521.33'  (en format: comma=thousands, dot=decimal)
    pdfjs produce: '37.016.521,33'  (es-CO format: dot=thousands, comma=decimal)
    
    Auto-detect format: if last decimal separator is ',' → es-CO, else → en.
    """
    s = text.strip()
    s = re.sub(r'[^\d,.\-]', '', s)
    if not s:
        return 0.0

    # Find the LAST comma or dot as the decimal separator
    last_comma = s.rfind(',')
    last_dot = s.rfind('.')
    neg = 1
    if s.startswith('-'):
        neg = -1
        s = s[1:]
    
    if last_comma > last_dot:
        # es-CO: last comma is decimal, dots are thousands
        s = s.replace('.', '').replace(',', '.')
        return float(s) * neg
    elif last_dot >= 0:
        # en: last dot is decimal, commas are thousands
        s = s.replace(',', '')
        return float(s) * neg
    else:
        # No decimals at all
        return float(s) * neg


def format_valor(n: float) -> str:
    """Format number for CSV: 25906412.00 → '25.906.412,00' (es-CO)"""
    s = f"{n:,.2f}"  # 25,906,412.00
    s = s.replace(',', 'X').replace('.', ',').replace('X', '.')
    return s


def extract_date_range(text: str):
    """Extract DESDE/HASTA dates from header."""
    m = re.search(r'DESDE:\s*(\d{4})/(\d{2})/(\d{2})\s+HASTA:\s*(\d{4})/(\d{2})/(\d{2})', text)
    if m:
        return {
            'desde': f"{m[1]}-{m[2]}-{m[3]}",
            'hasta': f"{m[4]}-{m[5]}-{m[6]}",
        }
    return None


def extract_saldos(text: str):
    """Extract SALDO ANTERIOR and SALDO ACTUAL from RESUMEN block.
    
    Both pdfjs and pypdf place these values with their labels:
    pdfjs: 'SALDO ANTERIOR ... $ 1,478.29 ... SALDO ACTUAL ... $ 70,565,811.95'
    pypdf: 'SALDO ANTERIOR $ 1,478.29 ... SALDO ACTUAL $ 70,565,811.95'
    """
    num = r'[\d,]+\.\d{2}|[\d.]+\,\d{2}'
    saldo_ant = re.search(rf'SALDO ANTERIOR[^$]*\$\s*({num})', text)
    saldo_act = re.search(rf'SALDO ACTUAL[^$]*\$\s*({num})', text)
    if saldo_ant and saldo_act:
        return {
            'saldoInicial': parse_monto(saldo_ant[1]),
            'saldoFinal': parse_monto(saldo_act[1]),
        }
    return None


def clean_text(text: str) -> str:
    """Remove page headers, RESUMEN blocks, FIN ESTADO, etc. — same as TS BancolombiaParser."""
    text = re.sub(r'ESTADO DE CUENTA.*?VALOR\s+SALDO\s*', '', text, flags=re.DOTALL)
    text = re.sub(r'FIN\s+ESTADO.*?(?=\s*-?\d[\d,]*\.\d{2}|\s*$)', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'VIGILADO', '', text)
    text = re.sub(r'[ \t]+', ' ', text).strip()
    return text


def extract_columnar(section: str, date_range: dict, year: int) -> list[dict]:
    """
    Extract rows from a columnar page section.
    
    Columnar format (pages 2+): all dates clustered, then all descriptions,
    then all amounts, then all saldos.
    """
    # Find all dates (D/M format)
    dates = re.findall(r'\b(\d{1,2}/\d{1,2})\b', section)
    n = len(dates)
    if n < 2:
        return []

    # Remove dates from text
    without_dates = re.sub(r'\b\d{1,2}/\d{1,2}\b', ' ', section)
    without_dates = re.sub(r'\s+', ' ', without_dates).strip()

    # Find ALL numbers — match either es-CO or en format
    # Format: optional -, digits with commas/dots, ending with .dd or ,dd
    all_numbers = []
    for m in re.finditer(r'(-?[\d,]+\.\d{2}|-?[\d.]+,\d{2})', without_dates):
        all_numbers.append(parse_monto(m[0]))
    if len(all_numbers) < n:
        return []

    # Split: first n numbers = amounts, last n numbers = saldos
    if len(all_numbers) >= n * 2:
        amounts = all_numbers[:n]
        saldos = all_numbers[-n:]
    else:
        k = max(0, len(all_numbers) - n)
        amounts = all_numbers[:k]
        saldos = all_numbers[k:]
        while len(amounts) < n:
            amounts.append(0)

    # Descriptions: anchor-based split (same as TS)
    desc_text = ''
    m = re.search(r'(-?[\d,]*\.\d{2})', without_dates)
    if m:
        desc_text = without_dates[:m.start()].strip()
    else:
        desc_text = without_dates

    anchors = re.split(
        r'\b(ABONO|AJUSTE|COBRO|COMPRA|CUOTA|IMPTO|PAGO|SERVICIO|TRANSFERENCIA|INTERBANC|0)\b\s*',
        desc_text,
        flags=re.IGNORECASE,
    )
    desc_parts = []
    i = 1
    while i < len(anchors) and len(desc_parts) < n:
        anchor = anchors[i] or ''
        rest = (anchors[i + 1] or '').strip() if i + 1 < len(anchors) else ''
        desc_parts.append((anchor + ' ' + rest).strip())
        i += 2

    # Merge excess
    while len(desc_parts) > n:
        best = 0
        best_len = float('inf')
        for j in range(len(desc_parts) - 1):
            combined = len(desc_parts[j].split()) + len(desc_parts[j + 1].split())
            if combined < best_len:
                best_len = combined
                best = j
        desc_parts[best] = (desc_parts[best] + ' ' + desc_parts[best + 1]).strip()
        desc_parts.pop(best + 1)

    while len(desc_parts) < n:
        desc_parts.append('')

    # Zip into rows
    rows = []
    for i in range(n):
        valor = amounts[i] if i < len(amounts) else 0
        saldo = saldos[i] if i < len(saldos) else 0
        # Parse date D/M → YYYY-MM-DD
        dia, mes = dates[i].split('/')
        # Infer year (simple: use the extract's year)
        anio = year
        fecha = f"{anio}-{int(mes):02d}-{int(dia):02d}"
        rows.append({
            'fecha': fecha,
            'descripcion': desc_parts[i] if i < len(desc_parts) else '',
            'valor': valor,
            'saldo': saldo,
        })
    return rows


def parse_bancolombia(text: str) -> dict:
    """Main parser — returns {'movimientos': [...], 'context': {...}}."""
    date_range = extract_date_range(text)
    saldos = extract_saldos(text)

    ctx = {
        'banco': 'Bancolombia',
        'saldoInicial': saldos['saldoInicial'] if saldos else 0,
        'saldoFinal': saldos['saldoFinal'] if saldos else 0,
        'periodoDesde': date_range['desde'] if date_range else None,
        'periodoHasta': date_range['hasta'] if date_range else None,
    }

    cleaned = clean_text(text)

    # Extract year from date range
    year = 2026
    if date_range:
        year = int(date_range['desde'][:4])

    # Try row-by-row extraction first, then columnar for remaining sections
    all_rows = []
    seen = set()

    for section in cleaned.split('\n\n'):
        section = section.strip()
        if not section:
            continue

        # Detect columnar: 4+ consecutive dates with only whitespace
        is_col = bool(re.search(r'\b(\d{1,2}/\d{1,2})\s+(\d{1,2}/\d{1,2})\s+(\d{1,2}/\d{1,2})\s+(\d{1,2}/\d{1,2})\b', section))

        if is_col:
            col_rows = extract_columnar(section, date_range, year)
            for r in col_rows:
                key = (r['fecha'], r['saldo'])
                if key not in seen:
                    seen.add(key)
                    all_rows.append(r)
        else:
            # Row-by-row: find dates and parse segments
            segments = re.findall(
                r'(?:^|\s)(\d{1,2}/\d{1,2})\s+(.*?)(?=\s+\d{1,2}/\d{1,2}\s+|$)',
                section,
                re.DOTALL,
            )
            for date_str, rest in segments:
                nums = re.findall(r'(-?[\d,]+\.\d{2}|-?[\d.]+,\d{2})', rest)
                if len(nums) >= 2:
                    valor = parse_monto(nums[-2])
                    saldo = parse_monto(nums[-1])
                    desc = rest[:rest.find(nums[-2])].strip()
                    dia, mes = date_str.split('/')
                    anio = year
                    fecha = f"{anio}-{int(mes):02d}-{int(dia):02d}"
                    key = (fecha, saldo)
                    if key not in seen and desc and desc != '0' and not re.match(r'^\d+$', desc.replace(',', '').replace('.', '').replace(' ', '')):
                        seen.add(key)
                        all_rows.append({
                            'fecha': fecha,
                            'descripcion': desc,
                            'valor': valor,
                            'saldo': saldo,
                        })

    return {'movimientos': all_rows, 'context': ctx}


# ── CSV generation ────────────────────────────────────────────────────────
def to_csv(parsed: dict, cuenta_num: str) -> str:
    """Generate CSV in the reference format."""
    ctx = parsed['context']
    movs = parsed['movimientos']

    lines = []
    lines.append(',,,,,')
    lines.append(f"Banco,{ctx['banco']},,,,")

    # Extract cuenta from filename or param
    lines.append(f"Cuenta,{cuenta_num},,,,")

    # Month/Year from periodoDesde
    mes = ''
    anio = ''
    if ctx.get('periodoDesde'):
        parts = ctx['periodoDesde'].split('-')
        mes = MONTHS_ES.get(int(parts[1]), '')
        anio = parts[0]
    lines.append(f"Mes,{mes},,,,")
    lines.append(f"Año,{anio},,,,")
    lines.append(f"Saldo anterior,\"{format_valor(ctx['saldoInicial'])}\",,,,")
    lines.append(f"Saldo final,\"{format_valor(ctx['saldoFinal'])}\",,,,")
    lines.append(',,,,,')

    lines.append('FECHA,DESCRIPCIÓN,SUCURSAL,DCTO.,VALOR,SALDO')

    for mov in movs:
        valor = abs(mov['valor']) if mov['valor'] < 0 else mov['valor']
        if mov['valor'] < 0:
            valor_str = f"-{format_valor(abs(mov['valor']))}" 
        else:
            valor_str = format_valor(mov['valor'])
        desc = mov['descripcion'].replace(',', '|')  # Escape commas
        lines.append(f"{mov['fecha']},{desc},,,\"{valor_str}\",\"{format_valor(mov['saldo'])}\"")

    lines.append(',FIN ESTADO DE CUENTA,,,,')
    return '\n'.join(lines) + '\n'


# ── Main ──────────────────────────────────────────────────────────────────
def process_pdf(pdf_path: str, output_dir: str | None = None):
    """Convert a single Bancolombia PDF to CSV."""
    path = Path(pdf_path)
    print(f"📄 {path.name}...", end=' ', flush=True)

    text = extract_text(str(path))
    if not text.strip():
        print("❌ sin texto extraíble")
        return

    parsed = parse_bancolombia(text)
    movs = parsed['movimientos']
    ctx = parsed['context']

    # Extract account number from filename
    cuenta_match = re.search(r'(\d{11,})', path.stem)
    cuenta_num = cuenta_match[1] if cuenta_match else '00000000000'

    csv = to_csv(parsed, cuenta_num)

    out_dir = Path(output_dir) if output_dir else path.parent
    out_path = out_dir / f"{path.stem}.csv"
    out_path.write_text(csv, encoding='utf-8')

    print(f"✅ {len(movs)} movs → {out_path.name}")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    pdfs: list[str] = []
    for arg in args:
        p = Path(arg)
        if p.is_dir():
            pdfs.extend(str(f) for f in p.glob('*.pdf'))
        elif p.suffix.lower() == '.pdf':
            pdfs.append(str(p))
        else:
            print(f"⚠ Ignorando: {arg} (no es PDF ni directorio)", file=sys.stderr)

    if not pdfs:
        print("No se encontraron PDFs.", file=sys.stderr)
        sys.exit(1)

    for pdf in pdfs:
        process_pdf(pdf)

    print(f"\n✅ {len(pdfs)} PDFs procesados.")


if __name__ == '__main__':
    main()
