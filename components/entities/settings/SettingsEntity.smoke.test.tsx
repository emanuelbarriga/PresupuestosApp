import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SettingsEntity } from './SettingsEntity';

// ─── Mock SettingsEditor ────────────────────────────────────────────────────

vi.mock('@/components/shared/SettingsEditor', () => ({
  SettingsEditor: ({ category, title }: { category: string; title: string }) => (
    <div data-testid="settings-editor">
      {title} — {category}
    </div>
  ),
}));

// ─── Helper ─────────────────────────────────────────────────────────────────

function renderEntity(props: Partial<Parameters<typeof SettingsEntity>[0]> = {}) {
  return render(
    <SettingsEntity
      mode="edit"
      companyId="c1"
      record={{
        category: 'tipoProyectos',
        title: 'Tipos de Proyecto',
        items: [
          { name: 'Construcción', color: '#22c55e', order: 0 },
          { name: 'Consultoría', color: '#6366f1', order: 1 },
        ],
      }}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onBack={vi.fn()}
      canGoBack={false}
      {...props}
    />,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SettingsEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza SettingsEditor con category y title del record', () => {
    renderEntity();
    expect(screen.getByTestId('settings-editor')).toHaveTextContent('Tipos de Proyecto — tipoProyectos');
  });

  it('renderiza edit mode sin crash', () => {
    renderEntity();
    expect(screen.getByTestId('settings-editor')).toBeInTheDocument();
  });
});
