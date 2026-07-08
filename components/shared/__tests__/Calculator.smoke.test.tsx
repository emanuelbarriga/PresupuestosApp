import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Calculator } from '../Calculator';

describe('Calculator', () => {
  it('renderiza los botones de operación', () => {
    render(<Calculator value="" onChange={() => {}} onResult={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('=')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('llama onChange al hacer click en un número', () => {
    const onChange = vi.fn();
    render(<Calculator value="" onChange={onChange} onResult={() => {}} />);
    fireEvent.click(screen.getByText('5'));
    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('limpia el valor con C', () => {
    const onChange = vi.fn();
    render(<Calculator value="123" onChange={onChange} onResult={() => {}} />);
    fireEvent.click(screen.getByText('C'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('llama onResult con el resultado de la operación', () => {
    const onResult = vi.fn();
    render(<Calculator value="2+3" onChange={() => {}} onResult={onResult} />);
    fireEvent.click(screen.getByText('='));
    expect(onResult).toHaveBeenCalledWith(5);
  });

  it('renderiza el botón "Usar este valor"', () => {
    render(<Calculator value="100" onChange={() => {}} onResult={() => {}} />);
    expect(screen.getByText('Usar este valor')).toBeInTheDocument();
  });
});
