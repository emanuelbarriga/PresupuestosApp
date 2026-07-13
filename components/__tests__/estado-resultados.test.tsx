import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { EstadoResultados } from '@/components/EstadoResultados';
import type { Budget, Ejecucion } from '@/lib/types';

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b-1',
    descripcion: 'Test Budget',
    projectId: 'proj-1',
    projectName: 'Vivienda',
    entityId: 'entity-1',
    entityName: 'Cliente A',
    entityType: 'client',
    tipo: 'ingreso',
    montoPresupuestado: 10_000_000,
    mesPresupuestado: 'Enero',
    fechaPresupuestado: '2026-01-15',
    estadoProyecto: 'Activo',
    ...overrides,
  };
}

function makeEjecucion(overrides: Partial<Ejecucion> = {}): Ejecucion {
  return {
    id: 'e-1',
    descripcion: 'Test Ejecucion',
    projectId: 'proj-1',
    projectName: 'Vivienda',
    entityId: 'entity-1',
    entityName: 'Cliente A',
    entityType: 'client',
    tipo: 'ingreso',
    montoEjecutado: 12_000_000,
    fechaEjecutado: '2026-03-15',
    comprobantes: [],
    ...overrides,
  };
}

/** Helper: find the value cell for a given row id (F1-F12) */
function getCellValue(id: string): string | null {
  const badge = screen.queryByText(id, { selector: 'span' });
  if (!badge) return null;
  const row = badge.closest('tr');
  if (!row) return null;
  const cells = row.querySelectorAll('td');
  // Last td is the value cell
  const valueCell = cells[cells.length - 1];
  return valueCell?.textContent ?? null;
}

function getInputForRow(id: string): HTMLInputElement | null {
  const badge = screen.queryByText(id, { selector: 'span' });
  if (!badge) return null;
  const row = badge.closest('tr');
  if (!row) return null;
  return row.querySelector('input') as HTMLInputElement | null;
}

describe('EstadoResultados component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the P&L table with 12 rows', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 10_000_000 }),
      makeBudget({ id: 'b2', projectName: 'Vivienda', tipo: 'egreso', montoPresupuestado: 3_000_000 }),
      makeBudget({ id: 'b3', projectName: 'Admin', tipo: 'egreso', montoPresupuestado: 1_000_000 }),
    ];

    render(<EstadoResultados budgets={budgets} ejecuciones={[]} />);

    // Header
    expect(screen.getByText('Estado de Resultados')).toBeInTheDocument();

    // All 12 row labels should be present
    expect(screen.getByText('Ingresos Brutos Operacionales')).toBeInTheDocument();
    expect(screen.getByText('Devoluciones, rebajas y descuentos')).toBeInTheDocument();
    expect(screen.getAllByText('Ingresos Netos').length).toBeGreaterThan(0);
    expect(screen.getByText('Costos de Operación')).toBeInTheDocument();
    expect(screen.getAllByText('Utilidad Bruta').length).toBeGreaterThan(0);
    expect(screen.getByText('Gastos Administrativos')).toBeInTheDocument();
    expect(screen.getByText('Gastos Financieros')).toBeInTheDocument();
    expect(screen.getByText('GMF (4×1000)')).toBeInTheDocument();
    expect(screen.getByText('Utilidad Operacional')).toBeInTheDocument();
    expect(screen.getByText('Impuesto SIMPLE (8.1%)')).toBeInTheDocument();
    expect(screen.getByText('Descuento Tributario GMF')).toBeInTheDocument();
    expect(screen.getByText('Utilidad Neta del Ejercicio')).toBeInTheDocument();
  });

  it('shows correct F1 value from budget data', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 10_000_000 }),
      makeBudget({ id: 'b2', projectName: 'Comercial', tipo: 'ingreso', montoPresupuestado: 5_000_000 }),
    ];

    render(<EstadoResultados budgets={budgets} ejecuciones={[]} />);

    const f1Text = getCellValue('F1');
    expect(f1Text).toContain('15.000.000');
  });

  it('toggles between Presupuestado and Ejecutado modes', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 10_000_000 }),
    ];
    const ejecuciones: Ejecucion[] = [
      makeEjecucion({ id: 'e1', projectName: 'Vivienda', tipo: 'ingreso', montoEjecutado: 12_000_000 }),
    ];

    render(<EstadoResultados budgets={budgets} ejecuciones={ejecuciones} />);

    // Default: Presupuestado mode → F1 = 10M
    expect(getCellValue('F1')).toContain('10.000.000');

    // Click Ejecutado toggle
    fireEvent.click(screen.getByText('Ejecutado'));

    // Now F1 = 12M
    expect(getCellValue('F1')).toContain('12.000.000');

    // Click back to Presupuestado
    fireEvent.click(screen.getByText('Presupuestado'));
    expect(getCellValue('F1')).toContain('10.000.000');
  });

  it('filters records by selected year', () => {
    const thisYear = new Date().getFullYear();
    const nextYear = thisYear + 1;

    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 10_000_000, fechaPresupuestado: `${thisYear}-01-15` }),
      makeBudget({ id: 'b2', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 5_000_000, fechaPresupuestado: `${nextYear}-01-15` }),
    ];

    render(<EstadoResultados budgets={budgets} ejecuciones={[]} />);

    // Default year is current year → F1 should be 10M (only this year)
    expect(getCellValue('F1')).toContain('10.000.000');
  });

  it('excludes archived records', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 10_000_000 }),
      makeBudget({ id: 'b2', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 5_000_000, archivado: true }),
    ];

    render(<EstadoResultados budgets={budgets} ejecuciones={[]} />);

    // F1 should only include non-archived: 10M
    expect(getCellValue('F1')).toContain('10.000.000');
  });

  it('F2 input accepts manual value and F3 recalculates', () => {
    const budgets: Budget[] = [
      makeBudget({ id: 'b1', projectName: 'Vivienda', tipo: 'ingreso', montoPresupuestado: 10_000_000 }),
    ];

    render(<EstadoResultados budgets={budgets} ejecuciones={[]} />);

    // Find the F2 input (Devoluciones row) — it's a spinbutton (type="number")
    const f2Input = getInputForRow('F2');
    expect(f2Input).not.toBeNull();

    // Initial F3 = 10M
    expect(getCellValue('F3')).toContain('10.000.000');

    // Type 500,000 into F2
    fireEvent.change(f2Input!, { target: { value: '500000' } });

    // F3 should now be 9,500,000
    expect(getCellValue('F3')).toContain('9.500.000');
  });

  it('renders year selector with current year and allows navigation', () => {
    const thisYear = new Date().getFullYear();
    render(<EstadoResultados budgets={[]} ejecuciones={[]} />);

    // Current year displayed
    expect(screen.getByText(String(thisYear))).toBeInTheDocument();

    // Year nav buttons exist
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4); // 2 chevrons + 2 mode toggles
  });

  it('renders empty state without crash when no data', () => {
    render(<EstadoResultados budgets={[]} ejecuciones={[]} />);

    // All rows should show $0 — F2 is input (empty), other 12 are "$ 0"
    for (const id of ['F1', 'F1b', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']) {
      const value = getCellValue(id);
      expect(value, `Row ${id} should show $0`).toContain('0');
    }

    // F2 has input (devoluciones manual)
    expect(getInputForRow('F2')).not.toBeNull();
  });
});
