/**
 * Format a number string with Colombian thousands separator (dots)
 * and comma decimal separator.
 *
 * Accepts both es-CO ("46658570,91") and en-US/JS ("46658570.91") input.
 * Always outputs es-CO format: "46.658.570,91".
 */
export function formatThousands(value: string): string {
  if (!value) return value;

  const isNegative = value.startsWith('-');
  let numStr = isNegative ? value.slice(1) : value;

  // Normalize: find the decimal part regardless of separator
  let decimalPart = '';
  const lastComma = numStr.lastIndexOf(',');
  const lastDot = numStr.lastIndexOf('.');

  if (lastComma >= 0 && lastComma > lastDot) {
    // es-CO input: comma = decimal, dots = thousand separators
    decimalPart = numStr.slice(lastComma + 1);
    numStr = numStr.slice(0, lastComma).replace(/\./g, '');
  } else if (lastDot >= 0) {
    // Could be en-US/JS decimal dot OR thousand-separator dot
    const afterDot = numStr.slice(lastDot + 1);
    if (afterDot.length >= 1 && afterDot.length <= 2 && /^\d{1,2}$/.test(afterDot)) {
      // It's a decimal dot — convert to comma for es-CO output
      decimalPart = numStr.slice(lastDot + 1);
      numStr = numStr.slice(0, lastDot).replace(/[.,]/g, '');
    } else {
      // Thousand-separator dot, strip all separators
      numStr = numStr.replace(/[.,]/g, '');
    }
  } else {
    // No decimal separator
    numStr = numStr.replace(/,/g, '');
  }

  if (!numStr || numStr === '-') return value;
  numStr = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Always output es-CO format: thousand dots + decimal comma
  return (isNegative ? '-' : '') + numStr + (decimalPart ? ',' + decimalPart : '');
}

/**
 * Remove formatting, return raw number string parseable by JS Number().
 * Accepts es-CO format ("46.658.570,91") → returns "46658570.91".
 */
export function unformatThousands(value: string): string {
  if (value.includes(',')) {
    // es-CO: dot = thousand separator, comma = decimal → swap comma to dot, remove dots
    return value.replace(/\./g, '').replace(',', '.');
  }
  return value.replace(/\./g, '');
}
