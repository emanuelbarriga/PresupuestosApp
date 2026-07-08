import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ColorSelect } from '../ColorSelect';

const items = [
  { name: 'Rojo', color: '#FF0000' },
  { name: 'Verde', color: '#00FF00' },
];

describe('ColorSelect', () => {
  it('renderiza con placeholder', () => {
    render(<ColorSelect value="" onChange={() => {}} items={items} placeholder="Elige un color" />);
    expect(screen.getByText('Elige un color')).toBeInTheDocument();
  });

  it('muestra el item seleccionado', () => {
    render(<ColorSelect value="Rojo" onChange={() => {}} items={items} />);
    expect(screen.getByText('Rojo')).toBeInTheDocument();
  });

  it('abre dropdown al hacer click', () => {
    render(<ColorSelect value="" onChange={() => {}} items={items} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Rojo')).toBeInTheDocument();
    expect(screen.getByText('Verde')).toBeInTheDocument();
  });
});
