'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Project, Budget, CuentaBancaria, SettingsCategorias, Comprobante } from '@/lib/types';
import { MONTHS, type Month } from '@/lib/types';
import { FormInput } from '@/components/forms/FormInput';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { TipoSwitch } from '@/components/forms/TipoSwitch';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { formatThousands, unformatThousands } from '@/lib/utils';
import { Link2, X, Plus } from 'lucide-react';
import clsx from 'clsx';
import { Calculator } from '@/components/shared/Calculator';
import { addClient, addProject } from '@/lib/firestore';
import { generateFilePath, uploadFile } from '@/lib/fileUpload';

type PendingComprobanteUploadResult = {
  id: string;
  name: string;
  url: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: string;
  descripcion?: string;
  tipo?: string;
};

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

import { ComprobanteUploader } from '@/components/upload/ComprobanteUploader';
interface PendingComprobante {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  descripcion?: string;
  tipo?: string;
}

// ── EjecucionForm ──

interface EjecucionFormProps {
  form: { mode: 'add' | 'edit'; type: 'ejecucion'; record?: any; defaults?: Record<string, string> };
  companyId: string;
  title: string;
  projects: Project[];
  clients: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string }>;
  clientsAndProviders: Array<{ value: string; label: string; type: string }>;
  allBudgets: Budget[];
  cuentas: CuentaBancaria[];
  settingsData: SettingsCategorias | null;
  onSubmit: (form: any, data: Record<string, any>) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  saving: boolean;
}

interface EjecucionFields {
  tipo: string;
  projectId: string;
  projectName: string;
  entityId: string;
  entityName: string;
  entityType: string;
  descripcion: string;
  montoEjecutado: string;
  fechaEjecutado: string;
  cuentaId: string;
  cuentaName: string;
}

export function EjecucionForm({
  form,
  companyId,
  title,
  projects,
  clients,
  providers,
  clientsAndProviders,
  allBudgets,
  cuentas,
  settingsData,
  onSubmit,
  onBack,
  onClose,
  saving: externalSaving,
}: EjecucionFormProps) {
  const [fields, setFields] = useState<EjecucionFields>(() => {
    if (form.mode === 'edit' && form.record) {
      const r = form.record as any;
      return {
        tipo: String(r.tipo ?? 'ingreso'),
        projectId: String(r.projectId ?? ''),
        projectName: String(r.projectName ?? ''),
        entityId: String(r.entityId ?? ''),
        entityName: String(r.entityName ?? 'Interno'),
        entityType: String(r.entityType ?? 'interno'),
        descripcion: String(r.descripcion ?? ''),
        montoEjecutado: String(r.montoEjecutado ?? ''),
        fechaEjecutado: String(r.fechaEjecutado ?? ''),
        cuentaId: String(r.cuentaId ?? ''),
        cuentaName: String(r.cuentaName ?? ''),
      };
    }
    const defs = form.defaults || {};
    return {
      tipo: defs.tipo ?? 'ingreso',
      projectId: defs.projectId ?? '',
      projectName: defs.projectName ?? '',
      entityId: defs.entityId ?? '',
      entityName: defs.entityName ?? 'Interno',
      entityType: defs.entityType ?? 'interno',
      descripcion: defs.descripcion ?? '',
      montoEjecutado: defs.montoEjecutado ?? '',
      fechaEjecutado: defs.fechaEjecutado ?? new Date().toISOString().split('T')[0],
      cuentaId: defs.cuentaId ?? '',
      cuentaName: defs.cuentaName ?? '',
    };
  });

  const [showCalc, setShowCalc] = useState(false);
  const [montoEditing, setMontoEditing] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(3);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [selectedBudgetLinks, setSelectedBudgetLinks] = useState<Array<{budgetId: string; budgetName: string; monto: string}>>([]);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [pendingComprobantes, setPendingComprobantes] = useState<PendingComprobante[]>([]);

  const ejecucionId = form.mode === 'edit' ? (form as any).record?.id : undefined;

  const safeProjects = projects || [];
  const set = (k: keyof EjecucionFields, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (form.mode === 'edit' && form.record) {
      setComprobantes(form.record.comprobantes || []);
    } else {
      setComprobantes([]);
      setPendingComprobantes([]);
    }
  }, [form]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const newId = await addProject(companyId, { name: newProjectName.trim(), clientName: newProjectClient.trim() || 'Sin cliente', clientId: '', estado: 'Activo' });
    set('projectId', newId);
    set('projectName', newProjectName.trim());
    setNewProjectName('');
    setNewProjectClient('');
    setShowNewProject(false);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const newId = await addClient({ name: newClientName.trim() });
    set('entityId', newId);
    set('entityName', newClientName.trim());
    set('entityType', 'client');
    setNewClientName('');
    setShowNewClient(false);
  };

  const handleSubmit = async () => {
    const data: Record<string, any> = { ...fields };
    const entries: Record<string, any>[] = [];
    const reps = recurring && form.mode === 'add' ? Math.max(1, recurringCount) : 1;

    // ── Upload pending comprobantes FIRST ──
    let uploadedComprobantes: PendingComprobanteUploadResult[] = [];
    if (pendingComprobantes.length > 0) {
      // For ADD mode, generate an ID now so files go to the right path
      const uploadId = ejecucionId || crypto.randomUUID();
      uploadedComprobantes = await Promise.all(
        pendingComprobantes.map(async (pc) => {
          const path = generateFilePath(companyId, uploadId, pc.name);
          const result = await uploadFile(pc.file, path);
          return {
            id: crypto.randomUUID(),
            name: pc.name,
            url: result.url,
            path: result.path,
            type: pc.type,
            size: pc.size,
            uploadedAt: new Date().toISOString(),
            ...(pc.descripcion ? { descripcion: pc.descripcion } : {}),
            ...(pc.tipo ? { tipo: pc.tipo } : {}),
          };
        }),
      );
      // Carries the pre-generated ID to page.tsx for ADD mode
      if (form.mode === 'add') {
        data._preGeneratedId = uploadId;
      }
    }

    const allComprobantes = [...comprobantes, ...uploadedComprobantes];

    for (let i = 0; i < reps; i++) {
      const entry = { ...data };
      if (!entry.projectId) entry.projectId = '';
      if (!entry.projectName) entry.projectName = '';
      if (!entry.entityId) entry.entityId = '';
      if (!entry.entityName) entry.entityName = 'Interno';
      if (!entry.entityType) entry.entityType = 'interno';
      entry.montoEjecutado = Number(entry.montoEjecutado) || 0;

      if (selectedBudgetLinks.length > 0) {
        entry._budgetLinks = selectedBudgetLinks.map(l => ({
          budgetId: l.budgetId,
          monto: Number(l.monto) || 0,
        }));
      }
      // Comprobantes already uploaded — include full metadata
      if (allComprobantes.length > 0) {
        entry.comprobantes = allComprobantes;
      }
      if (i > 0 && entry.fechaEjecutado) {
        const parts = (entry.fechaEjecutado as string).split('-');
        if (parts.length === 3) {
          let y = parseInt(parts[0], 10);
          let m = parseInt(parts[1], 10) + i;
          while (m > 12) { m -= 12; y++; }
          while (m < 1) { m += 12; y--; }
          entry.fechaEjecutado = `${y}-${String(m).padStart(2, '0')}-${parts[2]}`;
        }
      }
      // Each recurring entry gets its own pre-generated ID
      if (form.mode === 'add' && i > 0) {
        entry._preGeneratedId = crypto.randomUUID();
      }
      entries.push(entry);
    }
    for (const entry of entries) {
      await onSubmit(form, entry);
    }
    onBack();
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <TipoSwitch value={fields.tipo} onChange={v => set('tipo', v)} />
        <SearchableSelect label="Proyecto" value={fields.projectId || fields.projectName} onChange={v => {
          const p = safeProjects.find(p => p.id === v);
          if (p) { set('projectId', p.id); set('projectName', p.name); }
        }} options={safeProjects.map(p => ({ value: p.id, label: p.name }))} placeholder="Buscar proyecto..." />
        {!showNewProject && (
          <button onClick={() => setShowNewProject(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo proyecto
          </button>
        )}
        {showNewProject && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nombre del proyecto" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <input type="text" value={newProjectClient} onChange={e => setNewProjectClient(e.target.value)} placeholder="Cliente (opcional)" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateProject} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewProject(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <SearchableSelect label="Cliente / Proveedor" value={fields.entityId || fields.entityName} onChange={v => {
          if (!v) { set('entityId', ''); set('entityName', 'Interno'); set('entityType', 'interno'); return; }
          const allEntities = [...clients.map(c => ({ id: c.id, name: c.name, type: 'client' as const })), ...providers.map(p => ({ id: p.id, name: p.name, type: 'provider' as const }))];
          const entity = allEntities.find(e => e.id === v);
          if (entity) { set('entityId', entity.id); set('entityName', entity.name); set('entityType', entity.type); }
        }} options={clientsAndProviders} placeholder="Buscar cliente o proveedor..." />
        {!showNewClient && (
          <button onClick={() => setShowNewClient(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo cliente
          </button>
        )}
        {showNewClient && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del cliente" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleCreateClient} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewClient(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <FormInput label="Descripción" value={fields.descripcion} onChange={v => set('descripcion', v)} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Monto Ejecutado</label>
            <button type="button" onClick={() => { setShowCalc(!showCalc); if (!showCalc) setCalcExpr(fields.montoEjecutado || ''); }}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">
              🧮 Calc
            </button>
          </div>
          <input type="text" inputMode="numeric"
            value={montoEditing ? unformatThousands(fields.montoEjecutado) : formatThousands(fields.montoEjecutado)}
            onFocus={() => setMontoEditing(true)}
            onBlur={() => setMontoEditing(false)}
            onChange={e => set('montoEjecutado', unformatThousands(e.target.value))}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-right" />
          {showCalc && (
            <Calculator value={calcExpr} onChange={setCalcExpr} onResult={(res) => {
              set('montoEjecutado', String(res));
              setShowCalc(false);
            }} />
          )}
        </div>

        <FormInput label="Fecha de ejecución" value={fields.fechaEjecutado} onChange={v => set('fechaEjecutado', v)} type="date" />

        {/* Multi-budget linking */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
            <Link2 size={12} /> Vincular presupuestos (opcional)
          </p>
          <SearchableSelect label="" value="" onChange={v => {
            if (!v) return;
            const b = allBudgets.find(b => b.id === v);
            if (b && !selectedBudgetLinks.some(l => l.budgetId === b.id)) {
              setSelectedBudgetLinks(prev => [...prev, { budgetId: b.id, budgetName: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}`, monto: '' }]);
            }
          }} options={allBudgets.filter(b => !selectedBudgetLinks.some(l => l.budgetId === b.id)).map(b => ({ value: b.id, label: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}` }))} placeholder="Buscar presupuesto para vincular..." />
          {selectedBudgetLinks.map((link, idx) => (
            <div key={link.budgetId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 mt-2 border border-slate-200">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{link.budgetName}</p>
                <input type="text" inputMode="numeric" value={link.monto}
                  onChange={e => { const updated = [...selectedBudgetLinks]; updated[idx] = { ...updated[idx], monto: unformatThousands(e.target.value) }; setSelectedBudgetLinks(updated); }}
                  placeholder="Monto a vincular..."
                  className="w-full mt-1 border border-slate-200 rounded px-2 py-1 text-xs focus:border-indigo-500 outline-none bg-white" />
              </div>
              <button onClick={() => setSelectedBudgetLinks(prev => prev.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-500 transition-colors shrink-0" title="Quitar">
                <X size={14} />
              </button>
            </div>
          ))}
          {selectedBudgetLinks.length > 0 && (() => {
            const totalLinks = selectedBudgetLinks.reduce((s, l) => s + (Number(l.monto) || 0), 0);
            const montoEj = Number(fields.montoEjecutado) || 0;
            const diff = Math.abs(montoEj - totalLinks);
            const isValid = diff <= 1;
            return (
              <p className={clsx("text-[10px] font-bold mt-1.5", isValid ? 'text-emerald-600' : 'text-amber-600')}>
                Total vinculado: {formatCurrency(totalLinks)}
                {montoEj > 0 && !isValid && <span className="ml-1">— Diferencia: {formatCurrency(diff)}</span>}
                {isValid && montoEj > 0 && <span className="ml-1">✓</span>}
              </p>
            );
          })()}
        </div>

        {/* Comprobantes */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Comprobantes</p>
          <ComprobanteUploader
            companyId={companyId}
            ejecucionId={ejecucionId}
            comprobantes={comprobantes}
            onComprobantesChange={setComprobantes}
            pendingComprobantes={pendingComprobantes}
            onPendingChange={setPendingComprobantes}
            tiposComprobante={settingsData?.tipoComprobante || []}
            requiredTypes={['factura', 'soporte']}
            onSaveComprobantes={ejecucionId ? async (_id, comps) => { await onSubmit(form, { comprobantes: comps }); } : undefined}
          />
        </div>

        {/* Cuenta bancaria */}
        <SearchableSelect label="Cuenta bancaria (opcional)" value={fields.cuentaId}
          onChange={v => { set('cuentaId', v); const c = cuentas.find(c => c.id === v); if (c) set('cuentaName', `${c.banco} - ${c.nombre} (${c.tipo})`); }}
          options={cuentas.map(c => ({ value: c.id, label: `${c.banco} - ${c.nombre} (${c.tipo})` }))}
          placeholder="Buscar cuenta bancaria..." />

        {/* Recurring */}
        {form.mode === 'add' && (
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 mb-3">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-xs font-medium text-slate-600 select-none">Recurrente</span>
            </label>
            {recurring && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 shrink-0">Repetir por</span>
                <input type="number" min={1} max={60} value={recurringCount} onChange={e => setRecurringCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-slate-200 rounded-lg p-1.5 text-sm text-center focus:border-indigo-500 outline-none bg-white" />
                <span className="text-[11px] font-medium text-slate-500 shrink-0">meses</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSubmit} disabled={externalSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {externalSaving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
