import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DF } from '../DF';

describe('DF', () => {
  it('renderiza label y valor', () => {
    render(<DF label="Nombre" v="Juan Pérez" />);
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });
});
