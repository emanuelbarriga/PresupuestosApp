import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CustomizePanel } from '../CustomizePanel';

describe('CustomizePanel', () => {
  const defaultProps = {
    projects: [
      { id: 'p1', name: 'Proyecto Alpha', descripcion: 'Descripción Alpha', estado: 'activo', clientName: 'Cliente A', clientId: 'cl1', userId: 'u1', color: '#6366f1', tipo: 'ingreso', createdAt: new Date() },
      { id: 'p2', name: 'Proyecto Beta', descripcion: 'Descripción Beta', estado: 'activo', clientName: 'Cliente B', clientId: 'cl2', userId: 'u1', color: '#f59e0b', tipo: 'egreso', createdAt: new Date() },
    ],
    selectedProjects: new Set<string>(),
    projectSearch: '',
    onProjectsChange: vi.fn(),
    onSearchChange: vi.fn(),
    canGoBack: false,
    onBack: vi.fn(),
    onClose: vi.fn(),
  };

  it('renderiza el título del panel', () => {
    render(<CustomizePanel {...defaultProps} />);
    expect(screen.getByText('Configuración de Dashboard')).toBeInTheDocument();
  });

  it('muestra el campo de búsqueda', () => {
    render(<CustomizePanel {...defaultProps} />);
    expect(screen.getByPlaceholderText('Buscar proyecto...')).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay proyectos seleccionados', () => {
    render(<CustomizePanel {...defaultProps} />);
    expect(screen.getByText('Mostrando todos los proyectos. Buscá y seleccioná para filtrar.')).toBeInTheDocument();
  });
});
