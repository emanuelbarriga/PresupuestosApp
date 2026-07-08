'use client';

import React from 'react';

interface EntityTypeBadgeProps {
  type: string;
  name?: string;
}

const colors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700',
  provider: 'bg-amber-100 text-amber-700',
  interno: 'bg-purple-100 text-purple-700',
};

const labels: Record<string, string> = {
  client: 'Cliente',
  provider: 'Proveedor',
  interno: 'Interno',
};

/**
 * Presentational badge showing entity type with color-coded styling.
 *
 * Design contract: ({ type: string, name?: string }) => badge with color logic.
 * The `name` prop is accepted for extensibility but not rendered directly
 * (the label is derived from `type`).
 */
export function EntityTypeBadge({ type, name: _name }: EntityTypeBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${colors[type] || 'bg-slate-100 text-slate-600'}`}
    >
      {labels[type] || type}
    </span>
  );
}
