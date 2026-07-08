import { describe, it, expect } from 'vitest';
import { groupByEntity } from '../groupByEntity';

interface TestItem {
  id: string;
  entityId: string;
  entityType: 'client' | 'provider' | 'interno' | '';
  value: number;
}

describe('groupByEntity', () => {
  const items: TestItem[] = [
    { id: '1', entityId: 'e1', entityType: 'client', value: 100 },
    { id: '2', entityId: 'e1', entityType: 'client', value: 200 },
    { id: '3', entityId: 'e2', entityType: 'provider', value: 150 },
    { id: '4', entityId: 'e3', entityType: 'interno', value: 300 },
  ];

  it('agrupa items por entityId', () => {
    const result = groupByEntity(items);
    expect(result).toHaveLength(3);
  });

  it('asigna entityName según entityType para client', () => {
    const result = groupByEntity(items);
    const clientGroup = result.find(g => g.entityId === 'e1');
    expect(clientGroup).toBeDefined();
    expect(clientGroup!.entityName).toBe('Cliente');
    expect(clientGroup!.items).toHaveLength(2);
  });

  it('asigna entityName según entityType para provider', () => {
    const result = groupByEntity(items);
    const providerGroup = result.find(g => g.entityId === 'e2');
    expect(providerGroup).toBeDefined();
    expect(providerGroup!.entityName).toBe('Proveedor');
  });

  it('asigna entityName según entityType para interno', () => {
    const result = groupByEntity(items);
    const internoGroup = result.find(g => g.entityId === 'e3');
    expect(internoGroup).toBeDefined();
    expect(internoGroup!.entityName).toBe('Interno');
  });

  it('usa entityId como fallback cuando entityType es vacío', () => {
    const itemsWithEmpty = [
      ...items,
      { id: '5', entityId: 'e-unknown', entityType: '' as const, value: 50 },
    ];
    const result = groupByEntity(itemsWithEmpty);
    const unknownGroup = result.find(g => g.entityId === 'e-unknown');
    expect(unknownGroup).toBeDefined();
    expect(unknownGroup!.entityName).toBe('e-unknown');
  });

  it('retorna array vacío cuando no hay items', () => {
    expect(groupByEntity([])).toEqual([]);
  });

  it('preserva entityType genérico del grupo', () => {
    const result = groupByEntity(items);
    const clientGroup = result.find(g => g.entityId === 'e1');
    expect(clientGroup!.entityType).toBe('client');
  });
});
