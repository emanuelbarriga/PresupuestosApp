import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EntityTypeBadge } from '../EntityTypeBadge';

describe('EntityTypeBadge', () => {
  it('renderiza el label para client', () => {
    render(<EntityTypeBadge type="client" />);
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('renderiza el label para provider', () => {
    render(<EntityTypeBadge type="provider" />);
    expect(screen.getByText('Proveedor')).toBeInTheDocument();
  });

  it('renderiza el label para interno', () => {
    render(<EntityTypeBadge type="interno" />);
    expect(screen.getByText('Interno')).toBeInTheDocument();
  });

  it('usa el type como fallback para tipos desconocidos', () => {
    render(<EntityTypeBadge type="otro" />);
    expect(screen.getByText('otro')).toBeInTheDocument();
  });
});
