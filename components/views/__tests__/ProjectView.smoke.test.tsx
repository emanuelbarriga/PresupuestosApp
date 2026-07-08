import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProjectView } from '../ProjectView';
import { Project, Budget, Ejecucion } from '@/lib/types';

const mockProject: Project = {
  id: 'proj-1',
  name: 'PROJ-001',
  descripcion: 'Proyecto de prueba',
  clientName: 'Cliente A',
  clientId: 'client-1',
  estado: 'Activo',
};

const mockBudgets: Budget[] = [];
const mockEjecuciones: Ejecucion[] = [];

describe('ProjectView', () => {
  it('renderiza nombre y cliente del proyecto', () => {
    render(
      <ProjectView
        project={mockProject}
        budgets={mockBudgets}
        ejecuciones={mockEjecuciones}
        companyId="company-1"
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('PROJ-001')).toBeInTheDocument();
    expect(screen.getByText('Cliente A')).toBeInTheDocument();
  });

  it('muestra el detalle del proyecto header', () => {
    render(
      <ProjectView
        project={mockProject}
        budgets={mockBudgets}
        ejecuciones={mockEjecuciones}
        companyId="company-1"
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Detalle del Proyecto')).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay presupuestos', () => {
    render(
      <ProjectView
        project={mockProject}
        budgets={[]}
        ejecuciones={mockEjecuciones}
        companyId="company-1"
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Sin presupuestos')).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay ejecuciones', () => {
    render(
      <ProjectView
        project={mockProject}
        budgets={mockBudgets}
        ejecuciones={[]}
        companyId="company-1"
        onFormSubmit={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Sin ejecuciones')).toBeInTheDocument();
  });
});
