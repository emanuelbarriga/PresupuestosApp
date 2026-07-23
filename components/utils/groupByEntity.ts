/**
 * Generic utility to group items by entity, merging entries with the same
 * entityName even when entityId differs (e.g. legacy data with missing IDs).
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

  // 1. Group by entityId
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

  // 2. Merge entries with the same entityName (different entityId for the same tercero)
  const byName = new Map<string, { entityId: string; entityName: string; entityType: T['entityType']; items: T[] }>();
  for (const [entityId, group] of groups) {
    const name = group.entityName;
    if (!byName.has(name)) {
      byName.set(name, { entityId, entityName: name, entityType: group.entityType, items: [] });
    }
    const merged = byName.get(name)!;
    merged.items.push(...group.items);
    // Keep first entityId; mark mixed entityType if different
    if (merged.entityType !== group.entityType) {
      merged.entityType = 'ambos' as T['entityType'];
    }
  }

  return Array.from(byName.values());
}
