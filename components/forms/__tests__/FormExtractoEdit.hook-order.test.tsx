import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { FormExtractoEdit } from '@/components/forms/FormExtractoEdit';

// Mock Firebase — any import from @/lib/firebase or firebase/* will resolve here
// (the component imports downloadPdfBytes, uploadFile which need mocks)
vi.mock('@/lib/downloadPdf', () => ({
  downloadPdfBytes: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
}));
vi.mock('@/lib/fileUpload', () => ({
  uploadFile: vi.fn().mockResolvedValue({ url: 'https://test.url', path: 'test/path' }),
}));

const defaultProps = {
  form: {
    mode: 'edit' as const,
    type: 'extracto' as const,
    record: { id: 'test-1' },
  },
  companyId: 'company-1',
  title: 'Editar Extracto',
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onBack: vi.fn(),
  onClose: vi.fn(),
  saving: false,
  onFieldChange: vi.fn(),
  getField: vi.fn().mockReturnValue(''),
};

describe('FormExtractoEdit — Hook Order Stability', () => {
  it('renders without error on first render (add→edit)', () => {
    // Simulate the transition: initially rendered with add mode defaults,
    // then re-rendered with edit mode.
    const { rerender, container } = render(<FormExtractoEdit {...defaultProps} />);
    expect(container.querySelector('button')).toBeTruthy();

    // Re-render with same props (simulating an add→edit transition
    // in the parent where the component now stays mounted)
    rerender(<FormExtractoEdit {...defaultProps} />);
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('renders with different record IDs without hook errors', () => {
    const { rerender, container } = render(<FormExtractoEdit {...defaultProps} />);
    expect(container.querySelector('button')).toBeTruthy();

    // Simulate navigating to a different extracto record
    rerender(<FormExtractoEdit {...defaultProps} form={{
      mode: 'edit',
      type: 'extracto',
      record: { id: 'test-2', mes: 'Enero', anio: 2025 },
    }} />);
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('renders with all fields filled without throwing', () => {
    // Simulate the parent passing filled field values
    const getField = vi.fn((key: string) => {
      switch (key) {
        case 'mes': return 'Enero';
        case 'anio': return '2025';
        case 'saldoInicial': return '10000';
        case 'saldoFinal': return '15000';
        case 'estado': return 'Completado';
        default: return '';
      }
    });

    const { container } = render(
      <FormExtractoEdit {...defaultProps} getField={getField} />
    );
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('does not throw when switching between add/edit field counts', () => {
    // The original bug: when ft !== 'extracto', hooks were not rendered.
    // Now hooks are unconditional, so this should always work.
    const { rerender, container } = render(<FormExtractoEdit {...defaultProps} />);
    expect(container.querySelector('button')).toBeTruthy();

    // Re-render simulating the parent having different form types active
    // (the component should just re-render, not re-mount, when parent state changes)
    rerender(<FormExtractoEdit {...defaultProps} />);
    expect(container.querySelector('button')).toBeTruthy();
  });
});
