import { describe, it, expect } from 'vitest';

// Module smoke tests — verify each form module exports without errors
describe('Phase 2 — Form module smoke tests', () => {
  it('BudgetForm module loads', async () => {
    const mod = await import('@/components/forms/BudgetForm');
    expect(mod.BudgetForm).toBeDefined();
  });

  it('ProjectForm module loads', async () => {
    const mod = await import('@/components/forms/ProjectForm');
    expect(mod.ProjectForm).toBeDefined();
    expect(mod.ProjectFormData).toBeUndefined(); // interface, not a runtime export
  });

  it('TerceroForm module loads', async () => {
    const mod = await import('@/components/forms/TerceroForm');
    expect(mod.TerceroForm).toBeDefined();
  });

  it('CuentaForm module loads', async () => {
    const mod = await import('@/components/forms/CuentaForm');
    expect(mod.CuentaForm).toBeDefined();
  });

  it('EjecucionForm module loads', async () => {
    const mod = await import('@/components/forms/EjecucionForm');
    expect(mod.EjecucionForm).toBeDefined();
  });

  it('ExtractoAddForm module loads', async () => {
    const mod = await import('@/components/forms/ExtractoAddForm');
    expect(mod.ExtractoAddForm).toBeDefined();
  });

  it('FormExtractoEdit module loads', async () => {
    const mod = await import('@/components/forms/FormExtractoEdit');
    expect(mod.FormExtractoEdit).toBeDefined();
  });

  it('parsePipeline module exports both parseForPreview and runParsePipelineFromBuffer', async () => {
    const mod = await import('@/lib/parsers/parsePipeline');
    expect(mod.parseForPreview).toBeDefined();
    expect(mod.runParsePipelineFromBuffer).toBeDefined();
  });
});
