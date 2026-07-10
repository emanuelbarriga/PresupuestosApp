import { describe, it, expect } from 'vitest';
import type { EntityType } from '@/components/entities';

describe('entities barrel', () => {
  it('exporta EntityType (verificación compile-time)', () => {
    // EntityType es un tipo puro (no existe en runtime) —
    // la verificación real es que el import type compile sin error
    const t: EntityType = 'budget';
    expect(t).toBe('budget');
  });

  it('acepta todas las variantes de EntityType', () => {
    const variants: EntityType[] = [
      'budget', 'ejecucion', 'project', 'tercero',
      'cuenta', 'extracto', 'settings', 'invitacion',
      'colaborador', 'compania',
    ];
    expect(variants).toHaveLength(10);
    expect(variants.every(v => typeof v === 'string')).toBe(true);
  });
});
