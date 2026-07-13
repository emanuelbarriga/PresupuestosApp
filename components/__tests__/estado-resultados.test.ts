import { describe, it, expect } from 'vitest';
import { computePnL, type PnLRow } from '@/components/EstadoResultados';
import type { ErConfig } from '@/lib/types';
import { DEFAULT_ER_CONFIG } from '@/lib/er-config-defaults';

interface TestRecord {
  projectName: string;
  projectId?: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

function makeRecords(records: TestRecord[]): (TestRecord & { montoPresupuestado: number; montoEjecutado: number })[] {
  return records.map(r => ({
    ...r,
    montoPresupuestado: r.monto,
    montoEjecutado: r.monto,
  }));
}

describe('computePnL', () => {
  // ---- Spec scenario: P&L with mixed projects ----
  it('F1-F12 with mixed projects (Presupuestado)', () => {
    // Vivienda: ingresos $10M, egresos $3M
    // Admin:   ingresos $0, egresos $1M
    // Comercial: ingresos $5M, egresos $2M
    const records = makeRecords([
      { projectName: 'Vivienda', tipo: 'ingreso', monto: 10_000_000 },
      { projectName: 'Vivienda', tipo: 'egreso', monto: 3_000_000 },
      { projectName: 'Admin', tipo: 'ingreso', monto: 0 },
      { projectName: 'Admin', tipo: 'egreso', monto: 1_000_000 },
      { projectName: 'Comercial', tipo: 'ingreso', monto: 5_000_000 },
      { projectName: 'Comercial', tipo: 'egreso', monto: 2_000_000 },
    ]);

    const result = computePnL(records, 'Presupuestado', 0, 0);

    // Verify all 13 rows exist (F1b added)
    expect(result).toHaveLength(13);

    const byId = new Map(result.map(r => [r.id, r.value]));

    // F1 = 10M + 0 + 5M = 15M
    expect(byId.get('F1')).toBe(15_000_000);
    // F2 = 0 (manual default)
    expect(byId.get('F2')).toBe(0);
    // F3 = F1 - F2 = 15M
    expect(byId.get('F3')).toBe(15_000_000);
    // F4 = egresos non-Admin = Vivienda(3M) + Comercial(2M) = 5M
    expect(byId.get('F4')).toBe(5_000_000);
    // F5 = F3 - F4 = 10M
    expect(byId.get('F5')).toBe(10_000_000);
    // F6 = egresos Admin = 1M
    expect(byId.get('F6')).toBe(1_000_000);
    // F7 = 0 (manual default)
    expect(byId.get('F7')).toBe(0);
    // F8 = (F4 + F6 + F7) * 0.004 = (5M + 1M + 0) * 0.004 = 24,000
    expect(byId.get('F8')).toBe(24_000);
    // F9 = F5 - F6 - F7 - F8 = 10M - 1M - 0 - 24k = 8,976,000
    expect(byId.get('F9')).toBe(8_976_000);
    // F10 = F1 * 0.081 = 15M * 0.081 = 1,215,000
    expect(byId.get('F10')).toBe(1_215_000);
    // F11 = min(F8, F10) = min(24k, 1,215k) = 24k
    expect(byId.get('F11')).toBe(24_000);
    // F12 = F9 - F10 + F11 = 8,976,000 - 1,215,000 + 24,000 = 7,785,000
    expect(byId.get('F12')).toBe(7_785_000);
  });

  // ---- Edge case: zero data ----
  it('returns all zeroes with no records', () => {
    const result = computePnL([], 'Presupuestado', 0, 0);
    expect(result).toHaveLength(13);
    for (const row of result) {
      expect(row.value).toBe(0);
    }
  });

  // ---- Edge case: Admin case-insensitive ----
  it('classifies Admin project case-insensitively', () => {
    const records = makeRecords([
      { projectName: 'ADMIN', tipo: 'egreso', monto: 500_000 },
      { projectName: 'admin', tipo: 'egreso', monto: 300_000 },
      { projectName: 'Admin', tipo: 'egreso', monto: 200_000 },
      { projectName: 'Vivienda', tipo: 'egreso', monto: 1_000_000 },
    ]);

    const result = computePnL(records, 'Presupuestado', 0, 0);
    const byId = new Map(result.map(r => [r.id, r.value]));

    // F6 should capture ALL Admin variants: 500k + 300k + 200k = 1M
    expect(byId.get('F6')).toBe(1_000_000);
    // F4 should only have Vivienda: 1M
    expect(byId.get('F4')).toBe(1_000_000);
  });

  // ---- Edge case: F2 and F7 manual values ----
  it('uses manual devoluciones (F2) and gastosFinancieros (F7)', () => {
    const records = makeRecords([
      { projectName: 'Vivienda', tipo: 'ingreso', monto: 1_000_000 },
    ]);

    const result = computePnL(records, 'Presupuestado', 200_000, 100_000);
    const byId = new Map(result.map(r => [r.id, r.value]));

    // F2 = manual input
    expect(byId.get('F2')).toBe(200_000);
    // F3 = F1 - F2 = 1M - 200k = 800k
    expect(byId.get('F3')).toBe(800_000);
    // F7 = manual input
    expect(byId.get('F7')).toBe(100_000);
    // F8 = (F4 + F6 + F7) * 0.004 = (0 + 0 + 100k) * 0.004 = 400
    expect(byId.get('F8')).toBe(400);
    // F9 = F5 - F6 - F7 - F8 = 800k - 0 - 100k - 400 = 699,600
    expect(byId.get('F9')).toBe(699_600);
  });

  // ---- Edge case: mode switch uses different monto field ----
  it('uses montoEjecutado in Ejecutado mode', () => {
    // Create records where montoPresupuestado differs from montoEjecutado
    const records = [
      {
        projectName: 'Vivienda',
        tipo: 'ingreso' as const,
        montoPresupuestado: 1_000_000,
        montoEjecutado: 2_000_000,
      },
    ];

    const resultPres = computePnL(records, 'Presupuestado', 0, 0);
    const resultEje = computePnL(records, 'Ejecutado', 0, 0);

    const f1Pres = resultPres.find(r => r.id === 'F1')!.value;
    const f1Eje = resultEje.find(r => r.id === 'F1')!.value;

    // Presupuestado reads montoPresupuestado (1M)
    expect(f1Pres).toBe(1_000_000);
    // Ejecutado reads montoEjecutado (2M)
    expect(f1Eje).toBe(2_000_000);
  });

  // ---- Edge case: rows have correct labels and metadata ----
  it('returns rows with correct ids, labels, editable flags, and bold flags', () => {
    const result = computePnL([], 'Presupuestado', 0, 0);

    const rows: Record<string, { label: string; editable: boolean; bold: boolean }> = {
      F1:  { label: 'Ingresos Brutos Operacionales',     editable: false, bold: false },
      F1b: { label: 'Otros Ingresos Operacionales',      editable: false, bold: false },
      F2:  { label: 'Devoluciones, rebajas y descuentos', editable: true,  bold: false },
      F3:  { label: 'Ingresos Netos',                    editable: false, bold: true  },
      F4:  { label: 'Costos de Operación',               editable: false, bold: false },
      F5:  { label: 'Utilidad Bruta',                    editable: false, bold: true  },
      F6:  { label: 'Gastos Administrativos',            editable: false, bold: false },
      F7:  { label: 'Gastos Financieros',                editable: false, bold: false },
      F8:  { label: 'GMF (4×1000)',                      editable: false, bold: false },
      F9:  { label: 'Utilidad Operacional',              editable: false, bold: true  },
      F10: { label: 'Impuesto SIMPLE (8.1%)',            editable: false, bold: false },
      F11: { label: 'Descuento Tributario GMF',          editable: false, bold: false },
      F12: { label: 'Utilidad Neta del Ejercicio',       editable: false, bold: true  },
    };

    for (const row of result) {
      const expected = rows[row.id];
      expect(expected, `Row ${row.id} missing from expected`).toBeDefined();
      expect(row.label).toBe(expected.label);
      expect(row.editable).toBe(expected.editable);
      expect(row.bold).toBe(expected.bold);
    }
  });

  // ---- Edge case: Ejecutado mode with same data ----
  it('computes correctly in Ejecutado mode', () => {
    const records = [
      {
        projectName: 'Vivienda',
        tipo: 'ingreso' as const,
        montoPresupuestado: 100_000,
        montoEjecutado: 10_000_000,
      },
      {
        projectName: 'Vivienda',
        tipo: 'egreso' as const,
        montoPresupuestado: 10_000,
        montoEjecutado: 3_000_000,
      },
      {
        projectName: 'Admin',
        tipo: 'egreso' as const,
        montoPresupuestado: 5_000,
        montoEjecutado: 1_000_000,
      },
    ];

    const result = computePnL(records, 'Ejecutado', 0, 0);
    const byId = new Map(result.map(r => [r.id, r.value]));

    // F1 = 10M
    expect(byId.get('F1')).toBe(10_000_000);
    // F4 = 3M (non-Admin egresos)
    expect(byId.get('F4')).toBe(3_000_000);
    // F6 = 1M (Admin egresos)
    expect(byId.get('F6')).toBe(1_000_000);
    // F8 = (3M + 1M + 0) * 0.004 = 16,000
    expect(byId.get('F8')).toBe(16_000);
    // F10 = 10M * 0.081 = 810,000
    expect(byId.get('F10')).toBe(810_000);
    // F11 = min(16k, 810k) = 16k
    expect(byId.get('F11')).toBe(16_000);
    // F3 = 10M - 0 = 10M
    // F5 = 10M - 3M = 7M
    // F9 = 7M - 1M - 0 - 16k = 5,984,000
    // F12 = 5,984,000 - 810,000 + 16,000 = 5,190,000
    expect(byId.get('F12')).toBe(5_190_000);
  });

  // ---- Edge case: empty string/whitespace project names ----
  it('treats whitespace-only "admin" as Admin', () => {
    const records = makeRecords([
      { projectName: '  Admin  ', tipo: 'egreso', monto: 1_000_000 },
      { projectName: 'Vivienda', tipo: 'egreso', monto: 500_000 },
    ]);

    const result = computePnL(records, 'Presupuestado', 0, 0);
    const byId = new Map(result.map(r => [r.id, r.value]));

    expect(byId.get('F6')).toBe(1_000_000);
    expect(byId.get('F4')).toBe(500_000);
  });

  // ---- Edge case: only Admin project ----
  it('handles only Admin project with zero F4', () => {
    const records = makeRecords([
      { projectName: 'Admin', tipo: 'ingreso', monto: 2_000_000 },
      { projectName: 'Admin', tipo: 'egreso', monto: 1_000_000 },
    ]);

    const result = computePnL(records, 'Presupuestado', 0, 0);
    const byId = new Map(result.map(r => [r.id, r.value]));

    expect(byId.get('F1')).toBe(2_000_000);
    expect(byId.get('F4')).toBe(0); // No non-Admin egresos
    expect(byId.get('F6')).toBe(1_000_000);
  });

  // ---- ER Config: default config produces identical output ----
  it('default config produces identical output to no config', () => {
    const records = makeRecords([
      { projectName: 'Vivienda', tipo: 'ingreso', monto: 10_000_000 },
      { projectName: 'Vivienda', tipo: 'egreso', monto: 3_000_000 },
      { projectName: 'Admin', tipo: 'egreso', monto: 1_000_000 },
      { projectName: 'Comercial', tipo: 'ingreso', monto: 5_000_000 },
      { projectName: 'Comercial', tipo: 'egreso', monto: 2_000_000 },
    ]);

    const resultWithout = computePnL(records, 'Presupuestado', 0, 0);
    const resultWith = computePnL(records, 'Presupuestado', 0, 0, DEFAULT_ER_CONFIG);

    expect(resultWith).toEqual(resultWithout);
  });

  // ---- ER Config: Régimen Común tax formula ----
  it('computes correctly under Régimen Común', () => {
    const records = makeRecords([
      { projectName: 'Vivienda', tipo: 'ingreso', monto: 10_000_000 },
      { projectName: 'Vivienda', tipo: 'egreso', monto: 3_000_000 },
      { projectName: 'Admin', tipo: 'egreso', monto: 1_000_000 },
    ]);

    const comunConfig: ErConfig = {
      ...DEFAULT_ER_CONFIG,
      taxRegime: 'comun',
    };

    const result = computePnL(records, 'Presupuestado', 0, 0, comunConfig);
    const byId = new Map(result.map(r => [r.id, r.value]));

    // F1 = 10M (ingresos)
    // F4 = 3M (non-Admin egresos)
    // F6 = 1M (Admin egresos)
    // F5 = F3 - F4 = 10M - 3M = 7M
    // F8 = 0 (no GMF in común regime)
    expect(byId.get('F8')).toBe(0);
    // F9 = F5 - F6 - F7 - F8 = 7M - 1M - 0 - 0 = 6M
    expect(byId.get('F9')).toBe(6_000_000);
    // F10 = F9 * 0.35 = 6M * 0.35 = 2,100,000
    expect(byId.get('F10')).toBe(2_100_000);
    // F11 = 0 (no GMF discount in común regime)
    expect(byId.get('F11')).toBe(0);
    // F12 = F9 - F10 = 6M - 2.1M = 3,900,000
    expect(byId.get('F12')).toBe(3_900_000);
    // Dynamic label
    const f10Row = result.find(r => r.id === 'F10');
    expect(f10Row?.label).toBe('Impuesto Renta (35%)');
  });

  // ---- ER Config: projectIds filter for gastosAdmin ----
  it('filters gastosAdmin by projectIds', () => {
    const records = makeRecords([
      { projectName: 'Admin', projectId: 'proj-admin', tipo: 'egreso', monto: 200_000 },
      { projectName: 'Oficina', projectId: 'proj-oficina', tipo: 'egreso', monto: 500_000 },
      { projectName: 'Vivienda', projectId: 'proj-viv', tipo: 'egreso', monto: 1_000_000 },
    ]);

    const customConfig: ErConfig = {
      ...DEFAULT_ER_CONFIG,
      lineItems: {
        ...DEFAULT_ER_CONFIG.lineItems,
        gastosAdmin: { projectIds: ['proj-oficina'] },
      },
    };

    const result = computePnL(records, 'Presupuestado', 0, 0, customConfig);
    const byId = new Map(result.map(r => [r.id, r.value]));

    // F6 should only capture 'Oficina' (500k), not 'Admin' (200k)
    expect(byId.get('F6')).toBe(500_000);
  });

  // ---- ER Config: ingresos filtered by projectIds ----
  it('filters ingresos by projectIds', () => {
    const records = [
      { projectName: 'Vivienda', projectId: 'proj-a', tipo: 'ingreso' as const, montoPresupuestado: 10_000_000, montoEjecutado: 10_000_000 },
      { projectName: 'Comercial', projectId: 'proj-b', tipo: 'ingreso' as const, montoPresupuestado: 5_000_000, montoEjecutado: 5_000_000 },
      { projectName: 'Admin', projectId: 'proj-c', tipo: 'ingreso' as const, montoPresupuestado: 2_000_000, montoEjecutado: 2_000_000 },
    ];

    const customConfig: ErConfig = {
      ...DEFAULT_ER_CONFIG,
      lineItems: {
        ...DEFAULT_ER_CONFIG.lineItems,
        ingresos: { projectIds: ['proj-a', 'proj-c'] },
      },
    };

    const result = computePnL(records, 'Presupuestado', 0, 0, customConfig);
    const byId = new Map(result.map(r => [r.id, r.value]));

    // F1 should only include proj-a (10M) + proj-c (2M) = 12M
    expect(byId.get('F1')).toBe(12_000_000);
  });

  // ---- ER Config: match by projectName when no projectId ----
  it('matches by projectName when no projectId set', () => {
    const records = makeRecords([
      { projectName: 'Vivienda', tipo: 'ingreso', monto: 10_000_000 },
      { projectName: 'Comercial', tipo: 'ingreso', monto: 5_000_000 },
    ]);

    const customConfig: ErConfig = {
      ...DEFAULT_ER_CONFIG,
      lineItems: {
        ...DEFAULT_ER_CONFIG.lineItems,
        ingresos: { projectIds: ['Vivienda'] },
      },
    };

    const result = computePnL(records, 'Presupuestado', 0, 0, customConfig);
    const byId = new Map(result.map(r => [r.id, r.value]));

    expect(byId.get('F1')).toBe(10_000_000);
  });

  // ---- ER Config: otrosIngresos ----
  it('includes otrosIngresos in total', () => {
    const records = makeRecords([
      { projectName: 'Vivienda', projectId: 'a', tipo: 'ingreso', monto: 10_000_000 },
      { projectName: 'Intereses', projectId: 'b', tipo: 'ingreso', monto: 2_000_000 },
    ]);

    const customConfig: ErConfig = {
      ...DEFAULT_ER_CONFIG,
      lineItems: {
        ...DEFAULT_ER_CONFIG.lineItems,
        ingresos: { projectIds: ['a'] },
        otrosIngresos: { projectIds: ['b'] },
      },
    };

    const result = computePnL(records, 'Presupuestado', 0, 0, customConfig);
    const byId = new Map(result.map(r => [r.id, r.value]));

    expect(byId.get('F1')).toBe(10_000_000);
    expect(byId.get('F1b')).toBe(2_000_000);
    expect(byId.get('F3')).toBe(12_000_000); // F1 + F1b - 0
  });
});
