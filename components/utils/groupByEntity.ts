/**
 * Generic utility to group items by entityId and entityType.
 * Deduplicates the pattern used 4x across Sidepanel.tsx.
 */
export function groupByEntity<
  T extends { entityId: string; entityType: 'client' | 'provider' | 'interno' | ''; entityName?: string },
>(
  items: T[],
): Array<{ entityId: string; entityName: string; entityType: T['entityType']; items: T[] }> {
  const typeLabels: Record<string, string> = {
    client: 'Cliente',
    provider: 'Proveedor',
    interno: 'Interno',
  };

  const groups = new Map<string, { entityName: string; entityType: T['entityType']; items: T[] }>();

  for (const item of items) {
    const key = item.entityId;
    if (!groups.has(key)) {
      groups.set(key, {
        entityName: item.entityName || typeLabels[item.entityType] || item.entityId,
        entityType: item.entityType,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  return Array.from(groups, ([entityId, group]) => ({
    entityId,
    entityName: group.entityName,
    entityType: group.entityType,
    items: group.items,
  }));
}
