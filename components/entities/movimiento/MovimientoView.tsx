'use client';

import { useState, useEffect, useRef } from 'react';
import type { MovimientoBancario, NavScreen, Ejecucion, EntityType, MovimientoBancarioInput, Banco } from '@/lib/types';
import { getEjecucion, updateMovimiento, subscribeMovimientos } from '@/lib/firestore';
import { ArrowRight, Pencil, Trash2, Eye, FileText } from 'lucide-react';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { ExtractoParseModal, type ExtractoParseHeader } from '@/components/bancos/ExtractoParseModal';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface MovimientoViewProps {
  movimiento: MovimientoBancario;
  cuentaName: string;
  cuentaId?: string;
  extractoId?: string;
  companyId: string;
  onNavigate: (screen: NavScreen) => void;
  onClose: () => void;
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => Promise<void>;
}

export function MovimientoView({ movimiento, cuentaName, cuentaId, extractoId, companyId, onNavigate, onClose, onSubmit }: MovimientoViewProps) {
  const isDebito = movimiento.debito != null && movimiento.debito > 0;
  const monto = isDebito ? movimiento.debito! : movimiento.credito ?? 0;
  const ejecucionId = (movimiento as any)._ejecucionId as string | undefined;
  const [loadingEjec, setLoadingEjec] = useState(false);

  const handleConvertir = () => {
    onNavigate({
      type: 'entity',
      entity: 'ejecucion',
      mode: 'create',
      defaults: {
        descripcion: movimiento.descripcion,
        fechaEjecutado: movimiento.fecha,
        montoEjecutado: String(Math.round(monto)),
        tipo: isDebito ? 'egreso' : 'ingreso',
        cuentaId: movimiento.bancoOrigen || '',
        cuentaName,
        _cuentaId: cuentaId ?? '',
        _extractoId: extractoId ?? '',
        _movimientoId: movimiento.id,
      },
    });
  };

  const loadEjecucion = async (): Promise<Ejecucion | null> => {
    if (!ejecucionId) return null;
    setLoadingEjec(true);
    try {
      return await getEjecucion(companyId, ejecucionId);
    } catch {
      toast.error('Error al cargar la ejecución');
      return null;
    } finally {
      setLoadingEjec(false);
    }
  };

  const handleVerEjecucion = async () => {
    const ejecucion = await loadEjecucion();
    if (ejecucion) onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'view', record: ejecucion });
  };

  const handleEditarEjecucion = async () => {
    const ejecucion = await loadEjecucion();
    if (ejecucion) onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'edit', record: ejecucion });
  };

  const handleEliminarEjecucion = async () => {
    if (!ejecucionId) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      toast((t) => (
        <div className="text-sm space-y-3">
          <p className="text-slate-700 font-medium">¿Eliminar la ejecución asociada?</p>
          <p className="text-xs text-slate-500">El movimiento volverá a estado "no convertido".</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => { toast.dismiss(t.id); resolve(false); }}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">No</button>
            <button onClick={() => { toast.dismiss(t.id); resolve(true); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Sí</button>
          </div>
        </div>
      ), { duration: Infinity });
    });
    if (!confirmed) return;

    console.log('[MovimientoView] Deletando ejecucion:', { companyId, ejecucionId, cuentaId, extractoId, movimientoId: movimiento.id });
    try {
      const ejecRef = doc(db, 'companies', companyId, 'ejecuciones', ejecucionId);
      console.log('[MovimientoView] Referencia:', ejecRef.path);
      await deleteDoc(ejecRef);
      console.log('[MovimientoView] deleteDoc OK');

      if (cuentaId && extractoId) {
        console.log('[MovimientoView] Marcando movimiento como no convertido');
        await updateMovimiento(companyId, cuentaId, extractoId, movimiento.id, { convertido: false, _ejecucionId: '' });
        console.log('[MovimientoView] updateMovimiento OK');
      }

      onClose();
      toast.success('Ejecución eliminada');
      console.log('[MovimientoView] Proceso completado');
    } catch (err) {
      console.error('[MovimientoView] Error al eliminar:', err);
      toast.error('Error al eliminar la ejecución');
    }
  };

  // ── Extracto modal ──
  const [extractoModal, setExtractoModal] = useState<{
    open: boolean; header: ExtractoParseHeader | null; movimientos: MovimientoBancarioInput[]; pdfUrl?: string;
  }>({ open: false, header: null, movimientos: [] });
  const extractoMovUnsub = useRef<(() => void) | null>(null);

  const handleVerExtracto = async () => {
    if (!extractoId || !cuentaId) {
      toast.error('No hay extracto asociado a este movimiento');
      return;
    }
    try {
      // Fetch extracto data
      const extSnap = await getDoc(doc(db, 'companies', companyId, 'cuentasBancarias', cuentaId, 'extractos', extractoId));
      const extData = extSnap.data();
      if (!extData) { toast.error('Extracto no encontrado'); return; }

      // Fetch cuenta for banco name
      const cueSnap = await getDoc(doc(db, 'companies', companyId, 'cuentasBancarias', cuentaId));
      const cueData = cueSnap.data();
      const banco = (cueData?.banco as string) || movimiento.bancoOrigen || 'No detectado';

      setExtractoModal({
        open: true,
        header: {
          mes: extData.mes ?? '',
          anio: extData.anio ?? new Date().getFullYear(),
          banco: banco as Banco,
          saldoInicial: extData.saldoInicial ?? 0,
          saldoFinal: extData.saldoFinal ?? 0,
        },
        movimientos: [],
        pdfUrl: extData.archivo?.url,
      });

      // Subscribe to movimientos
      extractoMovUnsub.current?.();
      extractoMovUnsub.current = subscribeMovimientos(companyId, cuentaId, extractoId, (movs) => {
        setExtractoModal(prev => ({ ...prev, movimientos: movs }));
      }, () => {});
    } catch {
      toast.error('Error al cargar el extracto');
    }
  };

  const handleCerrarExtracto = () => {
    extractoMovUnsub.current?.();
    extractoMovUnsub.current = null;
    setExtractoModal({ open: false, header: null, movimientos: [] });
  };

  useEffect(() => {
    return () => extractoMovUnsub.current?.();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Movimiento</p>
        <div className="flex items-center gap-1">
          {extractoId && cuentaId && (
            <button onClick={handleVerExtracto}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
              <FileText size={12} /> Extracto
            </button>
          )}
          {!movimiento.convertido ? (
            <button onClick={handleConvertir}
              className="flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
              <ArrowRight size={12} /> Ejecutar
            </button>
          ) : (
            <>
              <button onClick={handleVerEjecucion} disabled={loadingEjec}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                <Eye size={12} /> Ver
              </button>
              <button onClick={handleEditarEjecucion} disabled={loadingEjec}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                <Pencil size={12} /> Editar
              </button>
              <button onClick={handleEliminarEjecucion}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 px-2.5 py-1.5 rounded-lg transition-colors">
                <Trash2 size={12} /> Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Fecha</p>
        <p className="text-sm font-semibold text-slate-800">{movimiento.fecha}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Descripción</p>
        <p className="text-sm text-slate-700">{movimiento.descripcion}</p>
      </div>
      {movimiento.referencia && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Referencia</p>
          <p className="text-sm font-mono text-slate-600">#{movimiento.referencia}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Débito</p>
          <p className="text-sm font-bold text-rose-600">
            {movimiento.debito != null ? formatCurrency(movimiento.debito) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Crédito</p>
          <p className="text-sm font-bold text-emerald-600">
            {movimiento.credito != null ? formatCurrency(movimiento.credito) : '—'}
          </p>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Saldo</p>
        <p className="text-sm font-bold text-slate-800">{formatCurrency(movimiento.saldo)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Banco / Cuenta</p>
        <p className="text-sm text-slate-700">{movimiento.bancoOrigen}{cuentaName ? ` — ${cuentaName}` : ''}</p>
      </div>
      {movimiento.ordinal != null && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Ordinal</p>
          <p className="text-sm text-slate-600">#{movimiento.ordinal}</p>
        </div>
      )}
      {movimiento.requiereRevision && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[10px] font-bold text-amber-700 uppercase mb-0.5">Requiere Revisión</p>
          <p className="text-xs text-amber-600">{movimiento.revisionMotivo || 'Este movimiento requiere atención manual'}</p>
        </div>
      )}
      {movimiento.posibleDuplicado && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-[10px] font-bold text-purple-700 uppercase mb-0.5">Posible Duplicado</p>
          <p className="text-xs text-purple-600">Este movimiento podría ser un duplicado de otro en el extracto.</p>
        </div>
      )}

      {/* Extracto PDF preview modal */}
      <ExtractoParseModal
        open={extractoModal.open}
        file={null}
        pdfUrl={extractoModal.pdfUrl}
        header={extractoModal.header}
        movimientos={extractoModal.movimientos}
        loading={false}
        readOnly
        title="Extracto Bancario — Vista Previa"
        progress={null}
        error={null}
        onBancoChange={() => {}}
        onSave={() => {}}
        onCancel={handleCerrarExtracto}
      />
    </div>
  );
}
