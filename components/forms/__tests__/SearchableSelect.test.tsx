import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSearchableSelect } from '../SearchableSelect';

describe('MultiSearchableSelect', () => {
  const mockOptions = [
    { value: 'ej-1', label: 'Enero 2026' },
    { value: 'ej-2', label: 'Febrero 2026' },
    { value: 'ej-3', label: 'Marzo 2026' },
    { value: 'ej-4', label: 'Abril 2026' },
  ];

  it('renders label and placeholder', () => {
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={[]}
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    expect(screen.getByText('Ejecuciones')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar ejecución...')).toBeInTheDocument();
  });

  it('shows selected items as chips', () => {
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={['ej-1', 'ej-3']}
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    expect(screen.getByText('Enero 2026')).toBeInTheDocument();
    expect(screen.getByText('Marzo 2026')).toBeInTheDocument();
  });

  it('calls onChange with value removed when chip X is clicked', () => {
    const onChange = vi.fn();
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={['ej-1', 'ej-2']}
        onChange={onChange}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    // Find all remove buttons (× on chips)
    const removeButtons = screen.getAllByRole('button', { hidden: true });
    // The × buttons are the remove buttons for chips
    // Find the one next to "Enero 2026"
    const eneroChip = screen.getByText('Enero 2026');
    const removeBtn = eneroChip.parentElement?.querySelector('button');
    if (removeBtn) fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(['ej-2']);
  });

  it('opens dropdown on input focus and shows filtered options', () => {
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={[]}
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    const input = screen.getByPlaceholderText('Buscar ejecución...');
    fireEvent.focus(input);

    // Should show all options
    expect(screen.getByText('Enero 2026')).toBeInTheDocument();
    expect(screen.getByText('Febrero 2026')).toBeInTheDocument();
  });

  it('filters options based on search text', () => {
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={[]}
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    const input = screen.getByPlaceholderText('Buscar ejecución...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Feb' } });

    expect(screen.getByText('Febrero 2026')).toBeInTheDocument();
    expect(screen.queryByText('Enero 2026')).not.toBeInTheDocument();
  });

  it('adds a value when an option is clicked', () => {
    const onChange = vi.fn();
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={['ej-1']}
        onChange={onChange}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    // When values exist, the input field is still inside the container
    const container = screen.getByText('Ejecuciones').parentElement!;
    const input = container.querySelector('input')!;
    fireEvent.focus(input);

    const marzoOption = screen.getByText('Marzo 2026');
    fireEvent.click(marzoOption);

    expect(onChange).toHaveBeenCalledWith(['ej-1', 'ej-3']);
  });

  it('marks selected options visually', () => {
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={['ej-2']}
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    const container = screen.getByText('Ejecuciones').parentElement!;
    const input = container.querySelector('input')!;
    fireEvent.focus(input);

    // Open the dropdown and check that Febrero shows a checkmark
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('removes value when chip X is clicked for last remaining item', () => {
    const onChange = vi.fn();
    render(
      <MultiSearchableSelect
        label="Ejecuciones"
        values={['ej-1']}
        onChange={onChange}
        options={mockOptions}
        placeholder="Buscar ejecución..."
      />,
    );

    const eneroChip = screen.getByText('Enero 2026');
    const removeBtn = eneroChip.parentElement?.querySelector('button');
    if (removeBtn) fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
