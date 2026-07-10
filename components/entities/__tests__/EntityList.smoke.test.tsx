import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { NavScreen } from '@/lib/types';
import { EntityList } from '../EntityList';

const mockBudgets = [
  {
    id: 'b1',
    descripcion: 'Honorarios contables',
    montoPresupuestado: 500000,
    projectId: 'p1',
    projectName: 'Proyecto Test',
    entityId: 'e1',
    entityName: 'Cliente Uno',
    entityType: 'client' as const,
    tipo: 'egreso' as const,
    mesPresupuestado: 'Enero' as const,
    fechaPresupuestado: '2026-01',
    estadoProyecto: 'Activo' as const,
  },
  {
    id: 'b2',
    descripcion: 'Materiales',
    montoPresupuestado: 300000,
    projectId: 'p1',
    projectName: 'Proyecto Test',
    entityId: 'e1',
    entityName: 'Cliente Uno',
    entityType: 'client' as const,
    tipo: 'egreso' as const,
    mesPresupuestado: 'Enero' as const,
    fechaPresupuestado: '2026-01',
    estadoProyecto: 'Activo' as const,
  },
];

const mockEjecuciones = [
  {
    id: 'ej1',
    descripcion: 'Pago honorarios',
    montoEjecutado: 400000,
    projectId: 'p1',
    projectName: 'Proyecto Test',
    entityId: 'e1',
    entityName: 'Cliente Uno',
    entityType: 'client' as const,
    tipo: 'egreso' as const,
    fechaEjecutado: '2026-01-15',
    comprobantes: [],
  },
];

function renderList(props: Partial<Parameters<typeof EntityList>[0]> = {}) {
  return render(
    <EntityList
      mode="Presupuestado"
      tipo="egreso"
      title="Proyecto / Enero"
      subtitle="Detalle de egresos"
      budgets={mockBudgets}
      ejecuciones={mockEjecuciones}
      presupuestado={500000}
      ejecutado={400000}
      diferencia={100000}
      onNavigate={vi.fn()}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );
}

describe('EntityList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el título del panel', () => {
    renderList();
    expect(screen.getByText(/Proyecto \/ Enero/)).toBeInTheDocument();
  });

  it('renderiza el subtítulo', () => {
    renderList();
    expect(screen.getByText(/Detalle de egresos/)).toBeInTheDocument();
  });

  it('renderiza grupos de entidades agrupados por entity', () => {
    renderList();
    // El groupByEntity debe mostrar "Cliente Uno" + badge "Cliente"
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('renderiza items de presupuesto con descripción y monto', () => {
    renderList();
    expect(screen.getByText('Honorarios contables')).toBeInTheDocument();
    expect(screen.getByText('Materiales')).toBeInTheDocument();
    // Los montos en COP (aparecen en item row + footer)
    expect(screen.getAllByText(/\$ 500\.000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\$ 300\.000/)).toBeInTheDocument();
  });

  it('renderiza el total del grupo (suma de montos)', () => {
    renderList();
    // 500000 + 300000 = 800000
    expect(screen.getByText(/\$ 800\.000/)).toBeInTheDocument();
  });

  it('renderiza acciones Ver, Editar, Archivar, Ejecutar para cada presupuesto', () => {
    renderList();
    const verBtns = screen.getAllByText('Ver');
    const editarBtns = screen.getAllByText('Editar');
    const ejecutarBtns = screen.getAllByText('Ejecutar');
    expect(verBtns.length).toBeGreaterThanOrEqual(2);
    expect(editarBtns.length).toBeGreaterThanOrEqual(2);
    expect(ejecutarBtns.length).toBeGreaterThanOrEqual(2);
  });

  it('renderiza el footer con presupuestado/ejecutado/diferencia', () => {
    renderList();
    // Usamos getAllByText porque el monto aparece tanto en items como en footer
    const presupuestadoElements = screen.getAllByText(/\$ 500\.000/);
    expect(presupuestadoElements.length).toBeGreaterThanOrEqual(1);
    const ejecutadoElements = screen.getAllByText(/\$ 400\.000/);
    expect(ejecutadoElements.length).toBeGreaterThanOrEqual(1);
    // Diferencia: +$100.000
    expect(screen.getByText(/\+\$ 100\.000/)).toBeInTheDocument();
  });

  it('renderiza modo Ejecutado con items de ejecución', () => {
    renderList({ mode: 'Ejecutado' });
    expect(screen.getByText('Pago honorarios')).toBeInTheDocument();
    // En modo ejecutado, el monto aparece en item + footer + group total (3 veces)
    expect(screen.getAllByText(/\$ 400\.000/).length).toBeGreaterThanOrEqual(1);
  });

  describe('archive flow', () => {
    it('muestra confirmación al hacer click en Archivar', () => {
      renderList();
      const archiveBtn = screen.getAllByText('Archivar')[0];
      fireEvent.click(archiveBtn);
      expect(screen.getByText('Confirmar')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });

    it('llama a onSubmit con mode=archive al confirmar', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderList({ onSubmit });
      const archiveBtn = screen.getAllByText('Archivar')[0];
      fireEvent.click(archiveBtn);
      const confirmBtn = screen.getByText('Confirmar');
      fireEvent.click(confirmBtn);
      expect(onSubmit).toHaveBeenCalledWith({
        mode: 'archive',
        entity: 'budget',
        record: mockBudgets[0],
        data: { archivado: true },
      });
    });

    it('oculta confirmación al hacer click en Cancelar', () => {
      renderList();
      const archiveBtn = screen.getAllByText('Archivar')[0];
      fireEvent.click(archiveBtn);
      const cancelBtn = screen.getByText('Cancelar');
      fireEvent.click(cancelBtn);
      expect(screen.queryByText('Confirmar')).not.toBeInTheDocument();
    });
  });

  describe('navegación', () => {
    it('llama onNavigate con Ver presupuesto', () => {
      const onNavigate = vi.fn();
      renderList({ onNavigate });
      const verBtn = screen.getAllByText('Ver')[0];
      fireEvent.click(verBtn);
      // Should navigate to entity view
      const lastCall = onNavigate.mock.calls[0][0] as NavScreen;
      expect(lastCall).toMatchObject({ type: 'entity', entity: 'budget', mode: 'view' });
    });

    it('llama onNavigate con Editar presupuesto', () => {
      const onNavigate = vi.fn();
      renderList({ onNavigate });
      const editarBtn = screen.getAllByText('Editar')[0];
      fireEvent.click(editarBtn);
      const lastCall = onNavigate.mock.calls[0][0] as NavScreen;
      expect(lastCall).toMatchObject({ type: 'entity', entity: 'budget', mode: 'edit' });
    });

    it('llama onNavigate con Ejecutar (crear ejecucion)', () => {
      const onNavigate = vi.fn();
      renderList({ onNavigate });
      const ejecutarBtn = screen.getAllByText('Ejecutar')[0];
      fireEvent.click(ejecutarBtn);
      const lastCall = onNavigate.mock.calls[0][0] as NavScreen;
      expect(lastCall).toMatchObject({ type: 'entity', entity: 'ejecucion', mode: 'create' });
    });
  });

  describe('empty state', () => {
    it('muestra mensaje cuando no hay budgets en modo Presupuestado', () => {
      renderList({ budgets: [], presupuestado: 0 });
      expect(screen.getByText(/No hay presupuestos/)).toBeInTheDocument();
    });

    it('muestra mensaje cuando no hay ejecuciones en modo Ejecutado', () => {
      renderList({ mode: 'Ejecutado', ejecuciones: [], ejecutado: 0 });
      expect(screen.getByText(/No hay ejecuciones/)).toBeInTheDocument();
    });
  });

  describe('archived state', () => {
    it('muestra Desarchivar en vez de Archivar para items archivados', () => {
      const archivedBudgets = [
        { ...mockBudgets[0], archivado: true },
        { ...mockBudgets[1] },
      ];
      renderList({ budgets: archivedBudgets });
      expect(screen.getByText('Desarchivar')).toBeInTheDocument();
      // At least one "Archivar" still there for non-archived
      expect(screen.getAllByText('Archivar').length).toBeGreaterThanOrEqual(1);
    });

    it('llama a onSubmit con archivado=false al desarchivar', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const archivedBudgets = [
        { ...mockBudgets[0], archivado: true },
      ];
      renderList({ budgets: archivedBudgets, onSubmit });
      const desarchivarBtn = screen.getByText('Desarchivar');
      fireEvent.click(desarchivarBtn);
      const confirmBtn = screen.getByText('Confirmar');
      fireEvent.click(confirmBtn);
      expect(onSubmit).toHaveBeenCalledWith({
        mode: 'archive',
        entity: 'budget',
        record: archivedBudgets[0],
        data: { archivado: false },
      });
    });
  });

  describe('comprobantes inline (modo Ejecutado)', () => {
    it('muestra ComprobantesViewer cuando hay comprobantes', () => {
      const ejecucionesConComprobantes = [
        {
          ...mockEjecuciones[0],
          comprobantes: [
            { id: 'c1', name: 'factura.pdf', url: 'https://example.com/f1', path: 'companies/c1/ejecuciones/ej1/factura.pdf', type: 'application/pdf', size: 1024, uploadedAt: '2026-01-15T12:00:00Z' },
          ],
        },
      ];
      renderList({ mode: 'Ejecutado', ejecuciones: ejecucionesConComprobantes });
      expect(screen.getByText(/Comprobantes/)).toBeInTheDocument();
      expect(screen.getByText('factura.pdf')).toBeInTheDocument();
    });

    it('no muestra ComprobantesViewer cuando no hay comprobantes', () => {
      renderList({ mode: 'Ejecutado' });
      expect(screen.queryByText(/Comprobantes/)).not.toBeInTheDocument();
    });
  });
});
