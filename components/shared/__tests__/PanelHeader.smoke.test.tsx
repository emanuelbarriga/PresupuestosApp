import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PanelHeader } from '../PanelHeader';

describe('PanelHeader', () => {
  it('renderiza el título', () => {
    render(<PanelHeader title="Mi Panel" canGoBack={false} onBack={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Mi Panel')).toBeInTheDocument();
  });

  it('no muestra botón back cuando canGoBack es false — solo botón de cerrar', () => {
    render(<PanelHeader title="Test" canGoBack={false} onBack={() => {}} onClose={() => {}} />);
    // Solo debería haber 1 botón (el de cerrar), no el de back
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
  });

  it('muestra botón back cuando canGoBack es true', () => {
    const onBack = vi.fn();
    render(<PanelHeader title="Test" canGoBack={true} onBack={onBack} onClose={() => {}} />);
    const buttons = screen.getAllByRole('button');
    // Should have at least the back button
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[0]);
    expect(onBack).toHaveBeenCalled();
  });

  it('llama onClose al hacer click en cerrar', () => {
    const onClose = vi.fn();
    render(<PanelHeader title="Test" canGoBack={false} onBack={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});
