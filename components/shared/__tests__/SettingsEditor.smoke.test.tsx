import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsEditor } from '../SettingsEditor';

vi.mock('@/lib/firestore', () => ({
  updateSettings: vi.fn().mockResolvedValue(undefined),
}));

describe('SettingsEditor', () => {
  const defaultProps = {
    category: 'categoriasIngreso',
    title: 'Editar Categorías',
    items: [{ name: 'Ventas', color: '#6366f1', order: 0 }],
    companyId: 'c1',
    onClose: vi.fn(),
  };

  it('renderiza el título y los items', () => {
    render(<SettingsEditor {...defaultProps} />);
    expect(screen.getByText('Editar Categorías')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ventas')).toBeInTheDocument();
  });

  it('permite agregar un nuevo item', () => {
    render(<SettingsEditor {...defaultProps} />);
    fireEvent.click(screen.getByText('Agregar'));
    const inputs = screen.getAllByPlaceholderText('Nombre...');
    expect(inputs).toHaveLength(2);
  });

  it('permite eliminar un item', () => {
    render(<SettingsEditor {...defaultProps} />);
    const deleteButtons = screen.getAllByRole('button').filter(b => b.innerHTML.includes('trash'));
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('muestra el botón Guardar', () => {
    render(<SettingsEditor {...defaultProps} />);
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });
});
