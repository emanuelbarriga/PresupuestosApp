'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Project, Budget, CuentaBancaria, SettingsCategorias, Comprobante, Month } from '@/lib/types';
import { MONTHS } from '@/lib/types';
import { FormInput } from '@/components/forms/FormInput';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { TipoSwitch } from '@/components/forms/TipoSwitch';
import { formatThousands, unformatThousands } from '@/lib/utils';
import { Link2, X } from 'lucide-react';
import clsx from 'clsx';
import { Calculator } from '@/components/shared/Calculator';
import { addClient, addProvider, addProject } from '@/lib/firestore';
import { ejecucionSchema } from '@/lib/schemas';
import { ZodError } from 'zod';
import toast from 'react-hot-toast';
import { linkDocumentoToEntities } from '@/lib/mediaLinking';
import { ComprobanteUploader } from '@/components/upload/ComprobanteUploader';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface EjecucionFormProps {
  companyId: string;
  mode: 'add' | 'edit';
  record?: any;
  defaults?: Record<string, string>;
  projects: Project[];
  clients: Array<{ id: string; name: string }>;
  providers: Array<{ id: string; name: string }>;
  clientsAndProviders: Array<{ value: string; label: string; type: string }>;
  allBudgets: Budget[];
  cuentas: CuentaBancaria[];
  settingsData: SettingsCategorias | null;
  onFormSubmit: (data: Record<string, any>) => Promise<void>;
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
  companyId,
  mode,
  record,
  defaults,
  projects,
  clients,
  providers,
  clientsAndProviders,
  allBudgets,
  cuentas,
  settingsData,
  onFormSubmit,
  saving: externalSaving,
}: EjecucionFormProps) {
  const [fields, setFields] = useState<EjecucionFields>(() => {
    if (mode === 'edit' && record) {
      const r = record as any;
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
    const defs = defaults || {};
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

  const [selectedBudgetLinks, setSelectedBudgetLinks] = useState<Array<{budgetId: string; budgetName: string; monto: string}>>([]);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [uploadedDocumentoIds, setUploadedDocumentoIds] = useState<string[]>([]);
  const uploadedDocumentoIdsRef = useRef<string[]>([]);
  const [internalSaving, setInternalSaving] = useState(false);

  const ejecucionId = mode === 'edit' ? record?.id : undefined;

  const safeProjects = projects || [];

  // Filter + sort budgets for smart linking
  const filteredBudgets = useMemo(() => {
    const monto = Number(fields.montoEjecutado) || 0;

    // Fecha de la ejecución → mes (0-based) y año
    let ejecMonth = -1, ejecYear = 0;
    if (fields.fechaEjecutado) {
      const d = new Date(fields.fechaEjecutado + 'T12:00:00');
      ejecMonth = d.getMonth();
      ejecYear = d.getFullYear();
    }

    // Normalize for lenient matching: lowercase, strip accents, collapse spaces
    const normalize = (s: string) => {
      try { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
      catch { return s.toLowerCase().trim(); }
    };

    const step1 = allBudgets.filter(b => b.tipo === fields.tipo);
    const step2 = step1.filter(b => {
      if (fields.projectId) {
        if (b.projectId === fields.projectId) return true; // match por ID
        // ID no coincide → intentar por nombre
        if (fields.projectName) return normalize(b.projectName) === normalize(fields.projectName);
        return false;
      }
      if (fields.projectName) return normalize(b.projectName) === normalize(fields.projectName);
      return true;
    });
    const step3 = step2.filter(b => {
      if (fields.entityId) {
        if (b.entityId === fields.entityId) return true; // match por ID
        // ID no coincide → intentar por nombre
        if (fields.entityName && fields.entityName !== 'Interno') return normalize(b.entityName) === normalize(fields.entityName);
        return false;
      }
      if (fields.entityName && fields.entityName !== 'Interno') return normalize(b.entityName) === normalize(fields.entityName);
      return true;
    });
    const step4 = step3.filter(b => {
      if (ejecMonth < 0) return true;
      const bMonth = MONTHS.indexOf(b.mesPresupuestado);
      if (bMonth < 0) return true;
      const diff = Math.min(Math.abs(bMonth - ejecMonth), 12 - Math.abs(bMonth - ejecMonth));
      return diff <= 6;
    });
    const step5 = step4.filter(b => {
      if (monto === 0) return true;
      const ratio = Math.abs(b.montoPresupuestado - monto) / monto;
      return ratio <= 0.2;
    });

    return step5
      // 6. SCORING: ordenar por cercanía (proyecto + tercero + monto + fecha)
      .map(b => {
        // Distancia de mes considerando vuelta de año
        let monthDist = 0;
        if (ejecMonth >= 0) {
          const bMonth = MONTHS.indexOf(b.mesPresupuestado);
          monthDist = bMonth >= 0 ? Math.min(Math.abs(bMonth - ejecMonth), 12 - Math.abs(bMonth - ejecMonth)) : 99;
        }

        // Distancia de monto como porcentaje (0 = exacto, 0.2 = 20% de diferencia)
        const montoDist = monto > 0 ? Math.abs(b.montoPresupuestado - monto) / monto : 0;

        // Match de tercero por ID (0) o por nombre (1)
        const terceroMatch = fields.entityId
          ? (b.entityId === fields.entityId ? 0 : 1)
          : (fields.entityName && fields.entityName !== 'Interno')
            ? (normalize(b.entityName) === normalize(fields.entityName) ? 1 : 2)
            : 0;

        // Score compuesto: tercero (25%) + montoDist (10%) + monthDist (5%)
        // plus tiny montoDiff as tiebreaker so closer amounts rank first
        const montoDiff = Math.abs(b.montoPresupuestado - monto);
        const _score = (terceroMatch * 0.25 + montoDist * 0.10 + monthDist * 0.05)
          + montoDiff * 1e-9; // tiebreaker: closer amount wins
        return { ...b, _score };
      })
      .sort((a, b) => a._score - b._score);
  }, [allBudgets, fields.tipo, fields.projectId, fields.projectName, fields.entityId, fields.entityName, fields.montoEjecutado, fields.fechaEjecutado]);

  const set = (k: keyof EjecucionFields, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (mode === 'edit' && record) {
      setComprobantes(record.comprobantes || []);
    } else {
      setComprobantes([]);
      setUploadedDocumentoIds([]);
      uploadedDocumentoIdsRef.current = [];
    }
  }, [mode, record]);

  const handleUploadComplete = useCallback((documentoId: string) => {
    setUploadedDocumentoIds(prev => [...prev, documentoId]);
    uploadedDocumentoIdsRef.current = [...uploadedDocumentoIdsRef.current, documentoId];
  }, []);

  const handleSubmit = async () => {
    setInternalSaving(true);
    const data: Record<string, any> = { ...fields };
    // Preserve private movement-linking fields from defaults (set by Extractos direct conversion)
    if (defaults) {
      if (defaults._cuentaId) data._cuentaId = defaults._cuentaId;
      if (defaults._extractoId) data._extractoId = defaults._extractoId;
      if (defaults._movimientoId) data._movimientoId = defaults._movimientoId;
    }
    const entries: Record<string, any>[] = [];
    const reps = recurring && mode === 'add' ? Math.max(1, recurringCount) : 1;

    // For ADD mode, generate an ID now for the ejecucion ref
    let firstEjecucionId: string | undefined;
    if (mode === 'add') {
      firstEjecucionId = ejecucionId || crypto.randomUUID();
      data._preGeneratedId = firstEjecucionId;
    }

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
      // NOTE: comprobantes array is DEPRECATED — DocumentoMedio records are created
      // by ComprobanteUploader via flat Storage path + mediaService
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
      if (mode === 'add' && i > 0) {
        entry._preGeneratedId = crypto.randomUUID();
      }
      entries.push(entry);
    }
    const createdEjecucionIds: string[] = [];
    for (const entry of entries) {
      try {
        ejecucionSchema.parse(entry);
      } catch (err) {
        if (err instanceof ZodError) {
          toast.error(err.issues[0].message);
          return;
        }
        throw err;
      }
      await onFormSubmit(entry);
      // Track the created ejecucion ID for document linking
      if (entry._preGeneratedId) {
        createdEjecucionIds.push(entry._preGeneratedId);
      }
    }

    // ── Link uploaded documentos to the created ejecuciones ──
    // TODO: Wrap ejecucion creation + document linking in a single runTransaction
    // to eliminate the consistency gap between both operations.
    // Currently: onFormSubmit creates the ejecucion, then linkDocumentoToEntities runs
    // afterwards. If the app crashes between steps, documents remain por_clasificar.
    // See: sdd/sistema-medios-desacoplado design review — Two-Phase Commit.  
    const docsToLink = uploadedDocumentoIdsRef.current;
    if (docsToLink.length > 0 && createdEjecucionIds.length > 0) {
      try {
        for (const docId of docsToLink) {
          // For MVP, link to all created ejecuciones (same comprobante backs all recurring entries)
          await linkDocumentoToEntities(companyId, docId, {
            tipoDocumento: 'factura_venta' as any, // Default tipo — will be updated via classification
            periodo: new Date().toISOString().slice(0, 7),
            terceroId: fields.entityId || '',
            ejecucionIds: createdEjecucionIds,
          });
        }
      } catch (err) {
        console.error('[EjecucionForm] Error linking documentos:', err);
        toast.error('Ejecución creada, pero hubo un error al vincular los documentos');
      }
    }
    setInternalSaving(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-5">
        <TipoSwitch value={fields.tipo} onChange={v => set('tipo', v)} />
        <SearchableSelect label="Proyecto" value={fields.projectId || fields.projectName} onChange={v => {
          const p = safeProjects.find(p => p.id === v);
          if (p) { set('projectId', p.id); set('projectName', p.name); }
        }} options={safeProjects.map(p => ({ value: p.id, label: p.name }))} placeholder="Buscar proyecto..."
          onCreate={async (name) => {
            const newId = await addProject(companyId, { name, clientName: '', clientId: '', estado: 'Activo' });
            set('projectId', newId);
            set('projectName', name);
          }}
          createLabel="proyecto" />
        <SearchableSelect label="Cliente / Proveedor" value={fields.entityId || fields.entityName} onChange={v => {
          if (!v) { set('entityId', ''); set('entityName', 'Interno'); set('entityType', 'interno'); return; }
          const allEntities = [...clients.map(c => ({ id: c.id, name: c.name, type: 'client' as const })), ...providers.map(p => ({ id: p.id, name: p.name, type: 'provider' as const }))];
          const entity = allEntities.find(e => e.id === v);
          if (entity) { set('entityId', entity.id); set('entityName', entity.name); set('entityType', entity.type); }
        }} options={clientsAndProviders} placeholder="Buscar cliente o proveedor..."
          onCreate={async (name) => {
            const isIngreso = fields.tipo === 'ingreso';
            const newId = isIngreso
              ? await addClient({ name })
              : await addProvider({ name });
            set('entityId', newId);
            set('entityName', name);
            set('entityType', isIngreso ? 'client' : 'provider');
          }}
          createLabel="tercero" />
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
            const b = filteredBudgets.find(b => b.id === v);
            if (b && !selectedBudgetLinks.some(l => l.budgetId === b.id)) {
              const tercero = b.entityName && b.entityName !== 'Interno' ? ` - ${b.entityName}` : '';
              setSelectedBudgetLinks(prev => [...prev, { budgetId: b.id, budgetName: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}${tercero}`, monto: '' }]);
            }
          }} options={filteredBudgets.filter(b => !selectedBudgetLinks.some(l => l.budgetId === b.id)).map(b => {
            const tercero = b.entityName && b.entityName !== 'Interno' ? ` - ${b.entityName}` : '';
            return { value: b.id, label: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}${tercero}` };
          })} placeholder="Buscar presupuesto para vincular..." />
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
            tiposComprobante={settingsData?.tipoComprobante || []}
            requiredTypes={['factura', 'soporte']}
            onUploadComplete={handleUploadComplete}
          />
        </div>

        {/* Cuenta bancaria */}
        <SearchableSelect label="Cuenta bancaria (opcional)" value={fields.cuentaId}
          onChange={v => { set('cuentaId', v); const c = cuentas.find(c => c.id === v); if (c) set('cuentaName', `${c.banco} - ${c.nombre} (${c.tipo})`); }}
          options={cuentas.map(c => ({ value: c.id, label: `${c.banco} - ${c.nombre} (${c.tipo})` }))}
          placeholder="Buscar cuenta bancaria..." />

        {/* Recurring */}
        {mode === 'add' && (
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 mb-3">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-xs font-medium text-slate-600">Recurrente</span>
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
      <div className="pt-4 border-t border-slate-100 shrink-0">
        <button onClick={handleSubmit} disabled={internalSaving || externalSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {internalSaving || externalSaving ? 'Guardando...' : mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
