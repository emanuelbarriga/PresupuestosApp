import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TerceroGroupPanel } from '../TerceroGroupPanel';

describe('TerceroGroupPanel', () => {
  const defaultProps = {
    projects: [
      {
        projectId: 'p1',
        projectName: 'Proyecto Alpha',
        groups: [
          {
            entityId: 'e1',
            entityName: 'Cliente X',
            entityType: 'client' as const,
            budgets: [],
            ejecuciones: [],
            totalPresupuestado: 500000,
            totalEjecutado: 300000,
            diferencia: 200000,
          },
        ],
        totalPresupuestado: 500000,
        totalEjecutado: 300000,
        diferencia: 200000,
      },
    ],
    onCellClick: vi.fn(),
    mode: 'Presupuestado' as const,
  };

  it('renderiza el nombre del proyecto', () => {
    render(<TerceroGroupPanel {...defaultProps} />);
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
  });

  it('muestra el contador de terceros', () => {
    render(<TerceroGroupPanel {...defaultProps} />);
    expect(screen.getByText('(1 terceros)')).toBeInTheDocument();
  });

  it('muestra los encabezados de la tabla', () => {
    render(<TerceroGroupPanel {...defaultProps} />);
    expect(screen.getByText('Tercero')).toBeInTheDocument();
    expect(screen.getByText('Presupuestado')).toBeInTheDocument();
  });

  it('muestra mensaje de vacío cuando no hay proyectos', () => {
    render(<TerceroGroupPanel {...{ ...defaultProps, projects: [] }} />);
    expect(screen.getByText('No hay datos disponibles')).toBeInTheDocument();
  });
});
