import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FormSelect } from '../FormSelect';

const options = [
  { value: '1', label: 'Opción A' },
  { value: '2', label: 'Opción B' },
];

describe('FormSelect', () => {
  it('renderiza label y opciones', () => {
    render(<FormSelect label="Tipo" value="" onChange={() => {}} options={options} />);
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Opción A')).toBeInTheDocument();
    expect(screen.getByText('Opción B')).toBeInTheDocument();
  });

  it('llama onChange al seleccionar', () => {
    const onChange = vi.fn();
    render(<FormSelect label="Tipo" value="" onChange={onChange} options={options} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith('1');
  });
});
