import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BankConfirmModal } from '@/components/bancos/BankConfirmModal';

describe('BankConfirmModal', () => {
  const defaultProps = {
    open: true,
    detectedBank: 'Bancolombia' as const,
    loading: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onBankChange: vi.fn(),
  };

  it('shows detected bank name when bank is recognized', () => {
    render(<BankConfirmModal {...defaultProps} />);

    expect(screen.getByText(/Se detectó/)).toBeInTheDocument();
    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
  });

  it('shows manual dropdown when bank is NoDetectado', () => {
    render(<BankConfirmModal {...defaultProps} detectedBank="No detectado" />);

    expect(screen.getByText(/No se pudo detectar/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onConfirm when Parsear is clicked', () => {
    const onConfirm = vi.fn();
    render(<BankConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Parsear'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancelar is clicked', () => {
    const onCancel = vi.fn();
    render(<BankConfirmModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading', () => {
    render(<BankConfirmModal {...defaultProps} loading={true} />);

    expect(screen.getByText('Parseando...')).toBeDisabled();
    expect(screen.getByText('Cancelar')).toBeDisabled();
  });

  it('does not render when open is false', () => {
    render(<BankConfirmModal {...defaultProps} open={false} />);

    expect(screen.queryByText(/Se detectó/)).not.toBeInTheDocument();
  });

  it('calls onBankChange when dropdown selection changes', () => {
    const onBankChange = vi.fn();
    render(<BankConfirmModal {...defaultProps} detectedBank="No detectado" onBankChange={onBankChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Global66' } });
    expect(onBankChange).toHaveBeenCalledWith('Global66');
  });

  it('shows correct options in dropdown for manual selection', () => {
    render(<BankConfirmModal {...defaultProps} detectedBank="No detectado" />);

    const options = screen.getAllByRole('option');
    const optionTexts = options.map(o => o.textContent);
    expect(optionTexts).toContain('Bancolombia');
    expect(optionTexts).toContain('Bancoomeva');
    expect(optionTexts).toContain('Global66');
  });
});
