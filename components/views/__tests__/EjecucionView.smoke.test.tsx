import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EjecucionView } from '../EjecucionView';
import { Ejecucion } from '@/lib/types';

const mockEjecucion: Ejecucion = {
  id: 'ej-1',
  descripcion: 'Ejecución de prueba',
  projectName: 'PROJ-001',
  projectId: 'proj-1',
  entityId: 'entity-1',
  entityName: 'Cliente A',
  entityType: 'client',
  tipo: 'ingreso',
  montoEjecutado: 500000,
  fechaEjecutado: '2026-01-15',
  comprobantes: [],
};

describe('EjecucionView', () => {
  it('renderiza la descripción de la ejecución', () => {
    render(
      <EjecucionView
        ejecucion={mockEjecucion}
        companyId="company-1"
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Ejecución de prueba')).toBeInTheDocument();
  });

  it('muestra el monto', () => {
    render(
      <EjecucionView
        ejecucion={mockEjecucion}
        companyId="company-1"
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    // Use function matcher for currency (locale-dependent formatting)
    expect(screen.getByText((content) => content.includes('500') && (content.includes('000') || content.includes(',') || content.includes('.')))).toBeInTheDocument();
  });

  it('muestra Sin presupuestos vinculados cuando no hay links', () => {
    render(
      <EjecucionView
        ejecucion={mockEjecucion}
        companyId="company-1"
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Sin presupuestos vinculados')).toBeInTheDocument();
  });
});
