import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BudgetView } from '../BudgetView';
import { Budget } from '@/lib/types';

const mockBudget: Budget = {
  id: 'budget-1',
  descripcion: 'Presupuesto de prueba',
  projectName: 'PROJ-001',
  projectId: 'proj-1',
  entityId: 'entity-1',
  entityName: 'Cliente A',
  entityType: 'client',
  tipo: 'ingreso',
  montoPresupuestado: 1000000,
  mesPresupuestado: 'Enero',
  fechaPresupuestado: '2026-01-15',
  estadoProyecto: 'Activo',
};

describe('BudgetView', () => {
  it('renderiza la descripción del presupuesto', () => {
    render(
      <BudgetView
        budget={mockBudget}
        ejecuciones={[]}
        companyId="company-1"
        onClose={vi.fn()}
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Presupuesto de prueba')).toBeInTheDocument();
  });

  it('muestra el monto presupuestado', () => {
    render(
      <BudgetView
        budget={mockBudget}
        ejecuciones={[]}
        companyId="company-1"
        onClose={vi.fn()}
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    // Use function matcher for currency (locale-dependent formatting)
    expect(screen.getByText((content) => content.includes('1.000.000') || content.includes('1,000,000'))).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay ejecuciones', () => {
    render(
      <BudgetView
        budget={mockBudget}
        ejecuciones={[]}
        companyId="company-1"
        onClose={vi.fn()}
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
  });
});
