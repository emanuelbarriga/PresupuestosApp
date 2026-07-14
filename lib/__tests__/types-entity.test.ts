import { describe, it, expect } from 'vitest';
import type { EntityType, NavScreen, EntityProps } from '@/lib/types';

describe('EntityType', () => {
  it('acepta variante budget', () => {
    const t: EntityType = 'budget';
    expect(t).toBe('budget');
  });

  it('acepta variante ejecucion', () => {
    const t: EntityType = 'ejecucion';
    expect(t).toBe('ejecucion');
  });

  it('acepta variante project', () => {
    const t: EntityType = 'project';
    expect(t).toBe('project');
  });

  it('acepta variante tercero', () => {
    const t: EntityType = 'tercero';
    expect(t).toBe('tercero');
  });

  it('acepta variante cuenta', () => {
    const t: EntityType = 'cuenta';
    expect(t).toBe('cuenta');
  });

  it('acepta variante extracto', () => {
    const t: EntityType = 'extracto';
    expect(t).toBe('extracto');
  });

  it('acepta variante settings', () => {
    const t: EntityType = 'settings';
    expect(t).toBe('settings');
  });

  it('acepta variante invitacion', () => {
    const t: EntityType = 'invitacion';
    expect(t).toBe('invitacion');
  });

  it('acepta variante colaborador', () => {
    const t: EntityType = 'colaborador';
    expect(t).toBe('colaborador');
  });

  it('acepta variante compania', () => {
    const t: EntityType = 'compania';
    expect(t).toBe('compania');
  });
});

describe('NavScreen', () => {
  it('crea pantalla de navegación type=entity mode=create', () => {
    const screen: NavScreen = { type: 'entity', entity: 'budget', mode: 'create' };
    expect(screen.type).toBe('entity');
    if (screen.type === 'entity') {
      expect(screen.entity).toBe('budget');
      expect(screen.mode).toBe('create');
    }
  });

  it('crea pantalla type=entity mode=edit con record', () => {
    const screen: NavScreen & { type: 'entity' } = {
      type: 'entity',
      entity: 'budget',
      mode: 'edit',
      record: { id: 'b1', descripcion: 'test' },
    };
    expect(screen.type).toBe('entity');
    expect(screen.entity).toBe('budget');
    expect(screen.mode).toBe('edit');
    expect(screen.record?.id).toBe('b1');
  });

  it('crea pantalla type=entity mode=view con defaults', () => {
    const screen: NavScreen = {
      type: 'entity',
      entity: 'ejecucion',
      mode: 'view',
      record: { id: 'e1' },
      defaults: { projectId: 'p1' },
    };
    if (screen.type === 'entity') {
      expect(screen.entity).toBe('ejecucion');
      expect(screen.mode).toBe('view');
      expect(screen.defaults?.projectId).toBe('p1');
    }
  });

  it('crea pantalla customize', () => {
    const screen: NavScreen = { type: 'customize' };
    expect(screen.type).toBe('customize');
  });

  it('crea pantalla entity-list', () => {
    const screen: NavScreen = {
      type: 'entity-list',
      data: {
        title: 'Test', subtitle: '', formula: '',
        budgets: [], ejecuciones: [], value: 0,
        presupuestado: 0, ejecutado: 0, diferencia: 0,
        mode: 'Presupuestado', tipo: 'ingreso',
      },
    };
    expect(screen.type).toBe('entity-list');
    expect(screen.data.title).toBe('Test');
  });

  it('crea pantalla view con detalle-tercero', () => {
    const screen: NavScreen = {
      id: 'dt1', type: 'view',
      detail: { type: 'detalle-tercero', projects: [], totalPresupuestado: 0, totalEjecutado: 0, diferencia: 0 },
    };
    if (screen.type === 'view') {
      expect(screen.detail.type).toBe('detalle-tercero');
    }
  });
});

describe('EntityProps', () => {
  it('define el contrato completo', () => {
    const props: EntityProps = {
      mode: 'create',
      companyId: 'c1',
      onSubmit: async (action) => { /* noop */ },
      onNavigate: (screen) => { /* noop */ },
      onClose: () => { /* noop */ },
      onBack: () => { /* noop */ },
      canGoBack: false,
    };
    expect(props.mode).toBe('create');
    expect(props.companyId).toBe('c1');
    expect(props.canGoBack).toBe(false);
  });

  it('acepta mode edit con record', () => {
    const props: EntityProps = {
      mode: 'edit',
      companyId: 'c1',
      record: { id: 'b1' },
      onSubmit: async (action) => { /* noop */ },
      onNavigate: (screen) => { /* noop */ },
      onClose: () => { /* noop */ },
      onBack: () => { /* noop */ },
      canGoBack: true,
    };
    expect(props.mode).toBe('edit');
    expect(props.record?.id).toBe('b1');
  });

  it('acepta onSubmit con action archive', async () => {
    let captured: any = null;
    const props: EntityProps = {
      mode: 'view',
      companyId: 'c1',
      onSubmit: async (action) => { captured = action; },
      onNavigate: () => {},
      onClose: () => {},
      onBack: () => {},
      canGoBack: false,
    };
    await props.onSubmit({ mode: 'archive', entity: 'budget', record: { id: 'b1' }, data: { archivado: true } });
    expect(captured).not.toBeNull();
    expect(captured.mode).toBe('archive');
    expect(captured.entity).toBe('budget');
    expect(captured.data.archivado).toBe(true);
  });
});

describe('_linkedDocumentos expanded interface', () => {
  it('accepts all optional fields', () => {
    const entry: NonNullable<import('@/lib/types').Ejecucion['_linkedDocumentos']>[number] = {
      documentoId: 'doc-1',
      tipoDocumento: 'factura_venta',
      periodo: '2026-07',
      montoTotal: 1500000,
      proveedorTexto: 'Proveedor SA',
    };
    expect(entry.documentoId).toBe('doc-1');
    expect(entry.tipoDocumento).toBe('factura_venta');
    expect(entry.periodo).toBe('2026-07');
    expect(entry.montoTotal).toBe(1500000);
    expect(entry.proveedorTexto).toBe('Proveedor SA');
  });

  it('accepts minimal object with only required fields', () => {
    const entry: NonNullable<import('@/lib/types').Ejecucion['_linkedDocumentos']>[number] = {
      documentoId: 'doc-2',
      tipoDocumento: 'contrato',
    };
    expect(entry.documentoId).toBe('doc-2');
    expect(entry.tipoDocumento).toBe('contrato');
    expect(entry.periodo).toBeUndefined();
    expect(entry.montoTotal).toBeUndefined();
    expect(entry.proveedorTexto).toBeUndefined();
  });
});
