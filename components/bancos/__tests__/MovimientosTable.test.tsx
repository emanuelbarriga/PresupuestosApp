import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MovimientosTable } from '@/components/bancos/MovimientosTable';
import type { MovimientoBancario } from '@/lib/types';

// Mock lucide icons
vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="trash-icon">🗑</span>,
}));

describe('MovimientosTable', () => {
  const mockMovimientos: MovimientoBancario[] = [
    {
      id: 'mov-1',
      fecha: '2026-01-15',
      descripcion: 'Pago servicio',
      debito: 500000,
      saldo: 500000,
      moneda: 'COP',
      ordinal: 1,
      bancoOrigen: 'Bancolombia',
      requiereRevision: false,
      posibleDuplicado: false,
      createdAt: { seconds: 100, nanoseconds: 0 } as any,
    },
    {
      id: 'mov-2',
      fecha: '2026-01-20',
      descripcion: 'Depósito nómina',
      credito: 1000000,
      saldo: 1500000,
      moneda: 'COP',
      ordinal: 2,
      bancoOrigen: 'Bancolombia',
      requiereRevision: true,
      posibleDuplicado: false,
      createdAt: { seconds: 200, nanoseconds: 0 } as any,
    },
    {
      id: 'mov-3',
      fecha: '2026-01-25',
      descripcion: 'Transferencia',
      debito: 200000,
      saldo: 1300000,
      moneda: 'COP',
      ordinal: 3,
      bancoOrigen: 'Bancolombia',
      requiereRevision: false,
      posibleDuplicado: true,
      createdAt: { seconds: 300, nanoseconds: 0 } as any,
    },
  ];

  it('renders all movements in the table', () => {
    render(<MovimientosTable movimientos={mockMovimientos} onDelete={vi.fn()} />);

    expect(screen.getByText('Pago servicio')).toBeInTheDocument();
    expect(screen.getByText('Depósito nómina')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
  });

  it('shows formatted debit and credit values', () => {
    render(<MovimientosTable movimientos={mockMovimientos} onDelete={vi.fn()} />);

    // Check that rows with specific descriptions contain expected values
    const pagoRow = screen.getByText('Pago servicio').closest('tr')!;
    expect(pagoRow.textContent).toContain('500.000');
    expect(pagoRow.textContent).not.toContain('1.000.000');

    const depositoRow = screen.getByText('Depósito nómina').closest('tr')!;
    expect(depositoRow.textContent).toContain('1.000.000');
  });

  it('shows revision badge for movements with requiereRevision', () => {
    render(<MovimientosTable movimientos={mockMovimientos} onDelete={vi.fn()} />);

    expect(screen.getByText(/⚠.*Revisión/)).toBeInTheDocument();
  });

  it('shows duplicate badge for movements with posibleDuplicado', () => {
    render(<MovimientosTable movimientos={mockMovimientos} onDelete={vi.fn()} />);

    expect(screen.getByText(/ⓘ.*Duplicado/)).toBeInTheDocument();
  });

  it('calls onDelete when trash button is clicked on a duplicate', () => {
    const onDelete = vi.fn();
    render(<MovimientosTable movimientos={mockMovimientos} onDelete={onDelete} />);

    // The duplicate row (mov-3) should have a delete button
    const deleteButtons = screen.getAllByRole('button');
    // Find the one related to mov-3 (Transferencia)
    const transferenciaRow = screen.getByText('Transferencia').closest('tr')!;
    const deleteBtn = transferenciaRow.querySelector('button');
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn!);
    expect(onDelete).toHaveBeenCalledWith('mov-3');
  });

  it('shows empty message when no movements', () => {
    render(<MovimientosTable movimientos={[]} onDelete={vi.fn()} />);

    expect(screen.getByText(/Sin movimientos/)).toBeInTheDocument();
  });
});
