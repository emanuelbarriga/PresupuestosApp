'use client'

import { useState, useEffect, useMemo } from 'react';
import { Ejecucion, Budget, Comprobante, NavScreen, EntityType, MovimientoBancario, CuentaBancaria } from '@/lib/types';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeBudgets, removeBudgetLink, updateEjecucion } from '@/lib/firestore';
import { deleteFile } from '@/lib/fileUpload';
import { DF } from '@/components/shared/DF';
import { ComprobantesViewer } from '@/components/upload/ComprobantesViewer';
import { derivarEstadoComprobantes, REQUIRED_COMPROBANTE_TYPES } from '@/lib/comprobantes';
import { Link2, Unlink, ExternalLink, FileText, Plus } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface EjecucionViewProps {
  ejecucion: Ejecucion;
  companyId: string;
  cuentas?: CuentaBancaria[];
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => Promise<void>;
  onNavigate: (screen: NavScreen) => void;
}

export function EjecucionView({ ejecucion, companyId, cuentas, onSubmit, onNavigate }: EjecucionViewProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>(() => ejecucion.comprobantes || []);

  // ── Resolver nombre de cuenta bancaria ──
  const cuentaDisplayName = cuentas?.find(c => c.id === ejecucion.cuentaId)?.nombre || ejecucion.cuentaName || 'Sin cuenta bancaria';

  // ── Extracto / Movimiento vinculado ──
  const movId = (ejecucion as any)._movimientoId as string | undefined;
  const extId = (ejecucion as any)._extractoId as string | undefined;
  const [extractoInfo, setExtractoInfo] = useState<{ mes: string; anio: number } | null>(null);
  const [movimientoData, setMovimientoData] = useState<MovimientoBancario | null>(null);
  const [loadingExtracto, setLoadingExtracto] = useState(false);

  useEffect(() => {
    if (!movId || !extId || !ejecucion.cuentaId) return;
    setLoadingExtracto(true);

    const extRef = doc(db, 'companies', companyId, 'cuentasBancarias', ejecucion.cuentaId, 'extractos', extId);
    getDoc(extRef).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setExtractoInfo({ mes: d.mes as string, anio: d.anio as number });
      }
    });

    const movRef = doc(db, 'companies', companyId, 'cuentasBancarias', ejecucion.cuentaId, 'extractos', extId, 'movimientos', movId);
    getDoc(movRef).then(snap => {
      if (snap.exists()) {
        setMovimientoData({ id: snap.id, ...snap.data() } as MovimientoBancario);
      }
    }).finally(() => setLoadingExtracto(false));
  }, [companyId, ejecucion.cuentaId, movId, extId]);

  useEffect(() => {
    const unsub = subscribeBudgets(companyId, setBudgets);
    return () => unsub();
  }, [companyId]);

  // Live subscription to this ejecucion document — keeps comprobantes in sync
  useEffect(() => {
    const ejecucionRef = doc(db, 'companies', companyId, 'ejecuciones', ejecucion.id);
    const unsub = onSnapshot(ejecucionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.comprobantes) {
          setComprobantes(data.comprobantes as Comprobante[]);
        }
      }
    });
    return () => unsub();
  }, [companyId, ejecucion.id]);

  // Derive budgetLinks from budgets' linkedEjecuciones — no subcollection read needed
  const budgetLinks = useMemo(() => {
    const links: Array<{ id: string; budgetId: string; budgetName: string; monto: number }> = [];
    for (const b of budgets) {
      const match = (b.linkedEjecuciones ?? []).find(le => le.ejecucionId === ejecucion.id);
      if (match) {
        links.push({ id: match.ejecucionId, budgetId: b.id, budgetName: b.descripcion, monto: match.monto });
      }
    }
    return links;
  }, [budgets, ejecucion.id]);

  const handleRemoveLink = async (linkId: string) => {
    try {
      await removeBudgetLink(companyId, ejecucion.id, linkId);
    } catch (err) {
    }
  };

  const handleDeleteComprobante = async (comp: Comprobante) => {
    try {
      if (comp.path) await deleteFile(comp.path);
      const updated = comprobantes.filter(c => c.id !== comp.id);
      setComprobantes(updated);
      await updateEjecucion(companyId, ejecucion.id, { comprobantes: JSON.parse(JSON.stringify(updated)) });
    } catch (err) {
    }
  };

  return (
    <>
      <DF label="Descripción" v={ejecucion.descripcion} />
      <DF label="Proyecto" v={ejecucion.projectName} />
      <DF label="Cliente/Proveedor" v={ejecucion.entityName} />
      <DF label="Tipo" v={ejecucion.tipo} />
      <DF label="Monto" v={formatCurrency(ejecucion.montoEjecutado)} />
      <DF label="Fecha" v={ejecucion.fechaEjecutado} />
      <DF label="Cuenta bancaria" v={cuentaDisplayName} />

      {/* Extracto / Movimiento vinculado */}
      {movId && extId && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
            <ExternalLink size={12} /> Extracto bancario
          </p>
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-1.5">
            {loadingExtracto ? (
              <p className="text-[11px] text-slate-400 italic">Cargando...</p>
            ) : (
              <>
                <p className="text-[11px] text-slate-600">
                  {extractoInfo
                    ? <>Extracto de <span className="font-semibold text-slate-800">{extractoInfo.mes} de {extractoInfo.anio}</span></>
                    : <span className="italic text-slate-400">Extracto no encontrado</span>}
                </p>
                {movimientoData && (
                  <p className="text-[11px] text-slate-600">
                    Movimiento: <span className="font-semibold text-slate-800">{movimientoData.descripcion}</span>
                  </p>
                )}
                {movimientoData && (
                  <button
                    onClick={() => onNavigate({ type: 'entity', entity: 'movimiento', mode: 'view', record: movimientoData, defaults: { _cuentaId: ejecucion.cuentaId ?? '', _extractoId: extId } })}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg transition-all mt-1"
                  >
                    <ExternalLink size={11} /> Ver movimiento en extracto
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Link2 size={12} /> Presupuestos vinculados ({budgetLinks.length})
          </p>
          <button
            onClick={() =>
              onNavigate({
                type: 'entity',
                entity: 'budget',
                mode: 'create',
                defaults: {
                  descripcion: `Presupuesto: ${ejecucion.descripcion}`,
                  projectId: ejecucion.projectId || '',
                  projectName: ejecucion.projectName || '',
                  entityId: ejecucion.entityId || '',
                  entityName: ejecucion.entityName || '',
                  entityType: ejecucion.entityType || '',
                  tipo: ejecucion.tipo,
                },
              })
            }
            className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm px-3 py-1.5 rounded-lg transition-all hover:shadow-md"
          >
            <Plus size={13} /> Nuevo Presupuesto
          </button>
        </div>
        {budgetLinks.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Sin presupuestos vinculados</p>
        ) : budgetLinks.map(link => {
          const linkedBudget = budgets.find(b => b.id === link.budgetId);
          return (
            <div key={link.id} onClick={() => {
              if (linkedBudget) onNavigate({ type: 'entity', entity: 'budget', mode: 'view', record: linkedBudget });
            }} className={clsx("flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 rounded-lg p-3 mb-2 cursor-pointer transition-colors", !linkedBudget && 'opacity-60')}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-700 truncate">
                  {linkedBudget?.descripcion || 'Presupuesto eliminado'}
                </p>
                <p className="text-[10px] text-indigo-500">
                  {linkedBudget ? `${linkedBudget.projectName} • ${formatCurrency(linkedBudget.montoPresupuestado)}` : ''}
                  {link.monto > 0 && <span className="ml-2 font-bold">{formatCurrency(link.monto)}</span>}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleRemoveLink(link.id); }}
                className="text-slate-400 hover:text-rose-500 transition-colors shrink-0 ml-2" title="Desvincular">
                <Unlink size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {(() => {
        const stateResult = derivarEstadoComprobantes(ejecucion.comprobantes || [], REQUIRED_COMPROBANTE_TYPES);
        if (stateResult.estado !== 'Completada' || (ejecucion.comprobantes?.length ?? 0) > 0) {
          return (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Estado de comprobantes: {stateResult.estado}
                {stateResult.faltante && <span className="text-amber-600">({stateResult.faltante === 'falta_pago' ? 'falta pago' : 'falta cuenta de cobro'})</span>}
              </p>
            </div>
          );
        }
        return null;
      })()}

      {comprobantes.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <ComprobantesViewer comprobantes={comprobantes} onDelete={handleDeleteComprobante} />
        </div>
      )}
    </>
  );
}
