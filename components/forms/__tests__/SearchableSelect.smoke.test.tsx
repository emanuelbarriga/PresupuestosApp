import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SearchableSelect } from '../SearchableSelect';

const options = [
  { value: '1', label: 'Cliente A' },
  { value: '2', label: 'Proveedor B' },
];

describe('SearchableSelect', () => {
  it('renderiza label y placeholder', () => {
    render(<SearchableSelect label="Entidad" value="" onChange={() => {}} options={options} placeholder="Buscar..." />);
    expect(screen.getByText('Entidad')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
  });

  it('muestra el label del valor seleccionado', () => {
    render(<SearchableSelect label="Entidad" value="1" onChange={() => {}} options={options} placeholder="Buscar..." />);
    expect(screen.getByDisplayValue('Cliente A')).toBeInTheDocument();
  });

  it('abre dropdown al hacer focus', () => {
    render(<SearchableSelect label="Entidad" value="" onChange={() => {}} options={options} placeholder="Buscar..." />);
    fireEvent.focus(screen.getByPlaceholderText('Buscar...'));
    expect(screen.getByText('Cliente A')).toBeInTheDocument();
    expect(screen.getByText('Proveedor B')).toBeInTheDocument();
  });
});
