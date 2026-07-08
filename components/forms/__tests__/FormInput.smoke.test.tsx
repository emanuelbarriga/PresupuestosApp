import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FormInput } from '../FormInput';

describe('FormInput', () => {
  it('renderiza el label y el input', () => {
    render(<FormInput label="Nombre" value="" onChange={() => {}} />);
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('llama onChange al escribir', () => {
    const onChange = vi.fn();
    render(<FormInput label="Nombre" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('usa el type proporcionado', () => {
    render(<FormInput label="Edad" value="" onChange={() => {}} type="number" />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });
});
