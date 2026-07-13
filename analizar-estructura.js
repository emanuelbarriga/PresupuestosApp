/**
 * Analizador de estructura de Firestore
 *
 * Lee mi_estructura.json y genera un reporte legible con:
 *  - Campos, tipos, opcionalidad
 *  - Valores de ejemplo
 *  - Estructuras anidadas (objetos y arrays)
 *  - Timestamps vs strings
 *
 * Uso: node analizar-estructura.js
 */

const fs = require('fs');

const DATA_FILE = './mi_estructura.json';
const OUTPUT_FILE = './ESTRUCTURA.md';

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function describeType(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'array[]';
    const innerTypes = [...new Set(val.map(v => describeType(v).replace(/^array</, '').replace(/>$/, '')))];
    return `array<${innerTypes.join('|')}>`;
  }
  if (typeof val === 'object') {
    if (val._seconds != null && val._nanoseconds != null) return 'Timestamp';
    if (val.toDate && typeof val.toDate === 'function') return 'Timestamp';
    return 'object';
  }
  return typeof val;
}

function isTimestamp(val) {
  return val && typeof val === 'object' && '_seconds' in val && '_nanoseconds' in val;
}

function flattenFields(obj, prefix = '') {
  const fields = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fields;
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val) && !isTimestamp(val)) {
      // nested object — add the parent and recurse
      fields[path] = { type: 'object', sample: summarizeValue(val, 80) };
      Object.assign(fields, flattenFields(val, path));
    } else {
      fields[path] = { type: describeType(val), sample: summarizeValue(val, 80) };
    }
  }
  return fields;
}

function summarizeValue(val, maxLen = 60) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') {
    if (val.length > maxLen) return val.slice(0, maxLen) + '...';
    return val;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const items = val.slice(0, 2).map(v => summarizeValue(v, 40));
    const suffix = val.length > 2 ? ` … (+${val.length - 2} más)` : '';
    return `[${items.join(', ')}${suffix}]`;
  }
  if (isTimestamp(val)) {
    const d = new Date(val._seconds * 1000);
    return d.toISOString();
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).slice(0, 4);
    const suffix = Object.keys(val).length > 4 ? ' …' : '';
    return `{${keys.join(', ')}${suffix}}`;
  }
  return String(val).slice(0, maxLen);
}

function analyzeArray(arr) {
  if (!arr || arr.length === 0) return { count: 0, itemType: '—' };
  const fields = new Set();
  let hasPrimitives = false;
  for (const item of arr) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach(k => fields.add(k));
    } else {
      hasPrimitives = true;
    }
  }
  return {
    count: arr.length,
    itemType: hasPrimitives ? describeType(arr[0]) : 'object',
    fields: hasPrimitives ? [] : [...fields]
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ No se encuentra ${DATA_FILE}. Ejecutá primero obtener-estructura.js`);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const lines = [];

  lines.push('# 📊 Estructura de Firestore — PlanningSaman\n');
  lines.push(`Generado el ${new Date().toISOString().replace('T', ' a las ').slice(0, 22)}\n`);
  lines.push('## Resumen\n');
  lines.push(`| Colección | Documentos | Campos totales | Tamaño estimado |`);
  lines.push(`|-----------|-----------:|---------------:|----------------:|`);

  const collectionEntries = Object.entries(db);

  for (const [colName, docs] of collectionEntries) {
    const docIds = Object.keys(docs);
    const docValues = Object.values(docs);
    const rawSize = new Blob([JSON.stringify(docs)]).size;
    const sizeStr = rawSize > 1024 ? `${(rawSize / 1024).toFixed(1)} KB` : `${rawSize} B`;
    lines.push(`| \`${colName}\` | ${docValues.length} | — | ${sizeStr} |`);
  }

  lines.push('');

  // ---- Detailed analysis per collection ----
  for (const [colName, docs] of collectionEntries) {
    const docValues = Object.values(docs);
    const docIds = Object.keys(docs);

    lines.push(`---`);
    lines.push(`## 📁 \`${colName}\``);
    lines.push(`- **Documentos**: ${docValues.length}`);
    const idList = docIds.map(id => '`' + id + '`').join(', ');
    lines.push(`- **IDs**: ${idList}`);
    lines.push('');

    if (docValues.length === 0) {
      lines.push('_Colección vacía._\n');
      continue;
    }

    // ---- Field analysis across all docs ----
    const allFields = new Map(); // fieldPath -> { types: Set, present: count, samples: [] }

    for (const doc of docValues) {
      const flat = flattenFields(doc);
      for (const [path, info] of Object.entries(flat)) {
        if (!allFields.has(path)) {
          allFields.set(path, { types: new Set(), present: 0, samples: [] });
        }
        const entry = allFields.get(path);
        entry.types.add(info.type);
        entry.present++;
        if (entry.samples.length < 2) {
          entry.samples.push(info.sample);
        }
      }
    }

    // Detect which fields are always present vs optional
    const total = docValues.length;

    lines.push('### Campos\n');
    lines.push('| Campo | Tipo(s) | Requerido | Valores de ejemplo |');
    lines.push('|-------|---------|-----------|-------------------|');

    const sortedFields = [...allFields.entries()].sort((a, b) => {
      // required first, then alphabetical
      const aReq = a[1].present === total;
      const bReq = b[1].present === total;
      if (aReq !== bReq) return aReq ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });

    for (const [path, entry] of sortedFields) {
      const types = [...entry.types].join(', ');
      const required = entry.present === total ? '✅ Siempre' : `⚠️ ${entry.present}/${total}`;
      const samples = entry.samples.filter(s => s != null && s !== 'undefined' && s !== 'null').join('<br>');
      lines.push(`| \`${path}\` | ${types} | ${required} | ${samples || '—'} |`);
    }

    // ---- Array analysis ----
    const arrayFields = [];
    for (const [path, entry] of sortedFields) {
      if (entry.types.has('array') || [...entry.types].some(t => t.startsWith('array<'))) {
        arrayFields.push(path);
      }
    }

    if (arrayFields.length > 0) {
      lines.push('\n### Arrays detectados\n');
      lines.push('| Campo | Items | Estructura interna |');
      lines.push('|-------|------:|--------------------|');

      for (const fieldPath of arrayFields) {
        // find a sample value
        let sampleArr = null;
        for (const doc of docValues) {
          const val = getNestedValue(doc, fieldPath);
          if (Array.isArray(val) && val.length > 0) {
            sampleArr = val;
            break;
          }
        }
        if (sampleArr) {
          const analysis = analyzeArray(sampleArr);
          const innerFields = analysis.fields.length > 0
            ? '`' + analysis.fields.join('`, `') + '`'
            : analysis.itemType;
          lines.push(`| \`${fieldPath}\` | ${analysis.count} | ${innerFields} |`);
        } else {
          lines.push(`| \`${fieldPath}\` | 0 | — |`);
        }
      }
    }

    // ---- Subcollections ----
    const subcollections = [];
    for (const doc of docValues) {
      for (const [key, val] of Object.entries(doc)) {
        if (val && typeof val === 'object' && !Array.isArray(val) && !isTimestamp(val)) {
          const nestedKeys = Object.keys(val);
          if (nestedKeys.length > 0 && nestedKeys.some(k => typeof val[k] === 'object')) {
            subcollections.push({ field: key, keys: nestedKeys });
          }
        }
      }
    }

    if (subcollections.length > 0) {
      const unique = [...new Map(subcollections.map(s => [s.field, s])).values()];
      lines.push('\n### Objetos anidados\n');
      for (const sub of unique) {
        lines.push(`- \`${sub.field}\`: contiene { ${sub.keys.join(', ')} }`);
      }
    }

    lines.push('');
  }

  // ---- Edge cases ----
  lines.push('---\n');
  lines.push('## ⚠️ Observaciones\n');

  // Check for Timestamps stored as strings vs objects
  let timestampIssues = false;
  for (const [colName, docs] of collectionEntries) {
    for (const doc of Object.values(docs)) {
      for (const [key, val] of Object.entries(doc)) {
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
          lines.push(`- ⚠️ \`${colName}.${key}\` guarda fechas como **string ISO** en lugar de Timestamp de Firestore. Ej: \`${val.slice(0, 19)}\``);
          timestampIssues = true;
          break;
        }
      }
      if (timestampIssues) break;
    }
    if (timestampIssues) break;
  }
  if (!timestampIssues) {
    lines.push('- ✅ No se detectaron fechas como string ISO — probablemente usan Timestamp de Firestore.');
  }

  // Fields with mixed types
  for (const [colName, docs] of collectionEntries) {
    for (const doc of Object.values(docs)) {
      for (const [key, val] of Object.entries(doc)) {
        const type = describeType(val);
        // check same field in other docs
        // simplified: just flag potential issues
      }
    }
  }

  const totalDocs = collectionEntries.reduce((acc, [, docs]) => acc + Object.keys(docs).length, 0);
  lines.push(`- 📊 **${collectionEntries.length} colecciones**, **${totalDocs} documentos** en total.`);
  lines.push(`- 💾 Respaldado en \`mi_estructura.json\``);

  // Write output
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
  console.log(`✅ Reporte generado: ${OUTPUT_FILE}`);
  console.log(lines.join('\n'));
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

main();
