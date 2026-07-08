import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TipoSwitch } from '../TipoSwitch';

describe('TipoSwitch', () => {
  it('renderiza ambos botones', () => {
    render(<TipoSwitch value="ingreso" onChange={() => {}} />);
    expect(screen.getByText('Ingreso')).toBeInTheDocument();
    expect(screen.getByText('Egreso')).toBeInTheDocument();
  });

  it('llama onChange con ingreso', () => {
    const onChange = vi.fn();
    render(<TipoSwitch value="egreso" onChange={onChange} />);
    fireEvent.click(screen.getByText('Ingreso'));
    expect(onChange).toHaveBeenCalledWith('ingreso');
  });

  it('llama onChange con egreso', () => {
    const onChange = vi.fn();
    render(<TipoSwitch value="ingreso" onChange={onChange} />);
    fireEvent.click(screen.getByText('Egreso'));
    expect(onChange).toHaveBeenCalledWith('egreso');
  });
});
