'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Banco, Month, MovimientoBancarioInput } from '@/lib/types';
import { MONTHS } from '@/lib/types';
import { X, Trash2, Search } from 'lucide-react';
import { PdfViewer } from '@/components/shared/PdfViewer';
import clsx from 'clsx';

export interface ExtractoParseHeader {
  mes: Month | '';
  anio: number;
  banco: Banco;
  saldoInicial: number;
  saldoFinal: number;
}

export interface ExtractoParseProgress {
  stage: 'extrayendo' | 'reconciliando';
  current: number;
  total: number;
}

interface ExtractoParseModalProps {
  open: boolean;
  /** File object for creating a blob URL (new uploads) */
  file?: File | null;
  /** Direct URL for PDF preview (existing extractos, read-only view) */
  pdfUrl?: string | null;
  header: ExtractoParseHeader | null;
  movimientos: MovimientoBancarioInput[];
  loading: boolean;
  saving?: boolean;
  /** When true, hide all actions and show only a Cerrar button */
  readOnly?: boolean;
  /** Custom title for the modal header */
  title?: string;
  progress: ExtractoParseProgress | null;
  error: string | null;
  onBancoChange: (banco: Banco) => void;
  /** Called when the user edits a movimiento field in Corregir mode */
  onMovimientosChange?: (movimientos: MovimientoBancarioInput[]) => void;
  onSave: (header: ExtractoParseHeader) => void;
  onCancel: () => void;
  /** Pre-fill the search filter when modal opens */
  defaultSearch?: string;
}

const BANCOS_CONOCIDOS: Banco[] = ['Bancolombia', 'Bancoomeva', 'Global66'];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 }).format(val);

// Raw number formatting (no currency symbol) for editable inputs
const formatNumber = (val: number) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export function ExtractoParseModal({
  open,
  file,
  pdfUrl,
  header,
  movimientos,
  loading,
  saving = false,
  readOnly = false,
  title = 'Confirmar extracto',
  progress,
  error,
  onBancoChange,
  onMovimientosChange,
  onSave,
  onCancel,
  defaultSearch,
}: ExtractoParseModalProps) {
  const savingRef = useRef(false);
  const syncedRef = useRef(false);
  // Reset savingRef when the parent's saving prop goes back to false (save failed)
  if (saving === false && savingRef.current) savingRef.current = false;
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [localHeader, setLocalHeader] = useState<ExtractoParseHeader | null>(header);
  const [modalSearch, setModalSearch] = useState('');
  const [editMovimientos, setEditMovimientos] = useState<MovimientoBancarioInput[]>(() =>
    movimientos.map((m, i) => ({ ...m, ordinal: m.ordinal ?? i + 1 })),
  );

  // Adjust local state during render when props change, instead of syncing
  // via useEffect (see https://react.dev/learn/you-might-not-need-an-effect).
  const [prevHeader, setPrevHeader] = useState(header);
  if (header !== prevHeader) {
    setPrevHeader(header);
    setLocalHeader(header);
  }

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) { setCorrigiendo(false); setModalSearch(''); }
    if (open && defaultSearch) { setModalSearch(defaultSearch); }
  }

  // Sync movimientos → editMovimientos once per modal session:
  // catches async parse data arriving after modal opens (movimientos=[] → data)
  if (open && movimientos.length > 0 && !syncedRef.current) {
    syncedRef.current = true;
    setEditMovimientos(movimientos.map((m, i) => ({ ...m, ordinal: m.ordinal ?? i + 1 })));
  }
  // Reset syncedRef when modal closes
  if (!open && syncedRef.current) syncedRef.current = false;

  const displayMovimientos = corrigiendo ? editMovimientos : movimientos;

  const filteredMovimientos = useMemo(() => {
    if (!modalSearch.trim()) return displayMovimientos;
    const q = modalSearch.toLowerCase();
    return displayMovimientos.filter(m =>
      m.descripcion.toLowerCase().includes(q) ||
      (m.debito != null && String(Math.round(m.debito)).includes(q)) ||
      (m.credito != null && String(Math.round(m.credito)).includes(q))
    );
  }, [displayMovimientos, modalSearch]);

  const updateMovimiento = (ordinal: number, field: 'fecha' | 'descripcion' | 'debito' | 'credito' | 'saldo', rawValue: string) => {
    setEditMovimientos(prev => prev.map(m => {
      if (m.ordinal !== ordinal) return m;
      if (field === 'descripcion') return { ...m, descripcion: rawValue };
      const parsed = rawValue === '' ? undefined : Number(rawValue.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
      return { ...m, [field]: parsed };
    }));
  };
  // Sync editMovimientos back to parent after state settles
  useEffect(() => {
    if (!open) return;
    onMovimientosChange?.(editMovimientos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMovimientos, open]);

  // PDF preview: prefer direct URL (existing extractos), fallback to blob(file)
  const previewUrl = useMemo(
    () => pdfUrl ?? (file ? URL.createObjectURL(file) : null),
    [file, pdfUrl],
  );
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const showBancoSelector = corrigiendo || !!error;

  const setLocalField = (field: 'mes' | 'anio' | 'saldoInicial' | 'saldoFinal', value: string) => {
    setLocalHeader(prev => {
      if (!prev) return prev;
      if (field === 'anio' || field === 'saldoInicial' || field === 'saldoFinal') {
        return { ...prev, [field]: Number(value) || 0 };
      }
      return { ...prev, mes: value as Month };
    });
  };

  const handleBancoSelect = (banco: Banco) => {
    setLocalHeader(prev => (prev ? { ...prev, banco } : prev));
    onBancoChange(banco);
  };

  const handleDeleteMovimiento = (ordinal: number) => {
    setEditMovimientos(prev => prev
      .filter(m => m.ordinal !== ordinal)
      .map((m, i) => ({ ...m, ordinal: i + 1 })),
    );
  };

  const handleGuardarClick = () => {
    if (!localHeader || savingRef.current) return;
    savingRef.current = true;

    // Close modal immediately so the user sees feedback
    // The async save runs in background and closes the Sidepanel on completion
    const headerToSave = localHeader;
    setCorrigiendo(false);
    onSave(headerToSave);
  };

  const progressLabel = progress
    ? progress.stage === 'extrayendo'
      ? `Procesando ${progress.current} de ${progress.total} páginas`
      : `Reconciliando movimiento ${progress.current} de ${progress.total}`
    : 'Procesando...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-[95vw] max-w-[1600px] mx-4 h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {corrigiendo && (() => {
              const ords = editMovimientos.map(m => m.ordinal).sort((a, b) => a - b);
              const gaps: string[] = [];
              for (let gi = 1; gi < ords.length; gi++) {
                if (ords[gi] !== ords[gi - 1] + 1) gaps.push(`${ords[gi - 1]}→${ords[gi]}`);
              }
              if (gaps.length > 0) {
                return <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">Saltos en ordinales: {gaps.join(', ')}</span>;
              }
              // Re-numbering needed after deletions
              const totalOrd = editMovimientos.length;
              if (ords.length > 0 && ords[ords.length - 1] !== totalOrd) {
                return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">{totalOrd} movs, último ordinal {ords[ords.length - 1]}</span>;
              }
              return null;
            })()}
          </div>
          <button onClick={onCancel} className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left pane: data */}
          <div className="w-1/2 border-r border-slate-100 overflow-y-auto overflow-x-auto p-5 space-y-4">
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <span className="inline-block w-6 h-6 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs font-bold text-indigo-600">{progressLabel}</p>
              </div>
            )}

            {!loading && error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
                <p className="text-xs font-bold text-rose-700">{error}</p>
              </div>
            )}

            {!loading && localHeader && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <HeaderField label="Banco">
                    {showBancoSelector ? (
                      <select
                        value={localHeader.banco}
                        onChange={(e) => handleBancoSelect(e.target.value as Banco)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                      >
                        <option value="No detectado" disabled>Seleccionar...</option>
                        {BANCOS_CONOCIDOS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    ) : (
                      <p className="text-sm font-semibold text-slate-800">{localHeader.banco}</p>
                    )}
                  </HeaderField>
                  <HeaderField label="Mes">
                    {corrigiendo ? (
                      <select
                        value={localHeader.mes}
                        onChange={(e) => setLocalField('mes', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                      >
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <p className="text-sm font-semibold text-slate-800">{localHeader.mes || '—'}</p>
                    )}
                  </HeaderField>
                  <HeaderField label="Año">
                    {corrigiendo ? (
                      <input
                        type="number"
                        value={localHeader.anio}
                        onChange={(e) => setLocalField('anio', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-800">{localHeader.anio}</p>
                    )}
                  </HeaderField>
                  <HeaderField label="Saldo inicial">
                    {corrigiendo ? (
                      <input
                        type="number"
                        value={localHeader.saldoInicial}
                        onChange={(e) => setLocalField('saldoInicial', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(localHeader.saldoInicial)}</p>
                    )}
                  </HeaderField>
                  <HeaderField label="Saldo final">
                    {corrigiendo ? (
                      <input
                        type="number"
                        value={localHeader.saldoFinal}
                        onChange={(e) => setLocalField('saldoFinal', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(localHeader.saldoFinal)}</p>
                    )}
                  </HeaderField>
                </div>

                {/* Search filter */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="text" value={modalSearch} onChange={e => setModalSearch(e.target.value)}
                    placeholder="Filtrar por descripción, débito o crédito..."
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-[11px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400" />
                  {modalSearch && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      {filteredMovimientos.length} resultados
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <PreviewMovimientosTable
                    movimientos={filteredMovimientos}
                    editable={corrigiendo}
                    onEdit={corrigiendo ? updateMovimiento : undefined}
                    onDelete={corrigiendo ? handleDeleteMovimiento : undefined}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right pane: PDF preview */}
          <div className="w-1/2 bg-slate-50">
            {previewUrl ? (
              <PdfViewer fileUrl={previewUrl} pageMode="all" className="w-full h-full" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-slate-400">Sin vista previa</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          {readOnly ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={() => setCorrigiendo(c => !c)}
                disabled={loading || !!error || saving || !localHeader}
                className="px-4 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-40"
              >
                {corrigiendo ? 'Listo' : 'Corregir'}
              </button>
              <button
                onClick={handleGuardarClick}
                disabled={loading || !!error || saving || !localHeader}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}

type MovField = 'fecha' | 'descripcion' | 'debito' | 'credito' | 'saldo';

function PreviewMovimientosTable({
  movimientos,
  editable,
  onEdit,
  onDelete,
}: {
  movimientos: MovimientoBancarioInput[];
  editable?: boolean;
  onEdit?: (ordinal: number, field: MovField, value: string) => void;
  onDelete?: (ordinal: number) => void;
}) {
  if (movimientos.length === 0) {
    return <div className="p-4 text-center text-[10px] text-slate-400 italic">Sin movimientos extraídos</div>;
  }
  const sorted = [...movimientos].sort((a, b) =>
    (a.ordinal ?? 0) - (b.ordinal ?? 0) || a.fecha.localeCompare(b.fecha),
  );

  const cellCls = "w-full border border-slate-200 rounded p-1 text-[11px] text-right";

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-100">
          <th className="p-2 pl-3 text-[9px] font-bold text-slate-400 uppercase">Fecha</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase">Descripción</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Débito</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Crédito</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-right">Saldo</th>
          <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center w-20">Estado</th>
          {editable && <th className="p-2 text-[9px] font-bold text-slate-400 uppercase text-center w-12">Acción</th>}
        </tr>
      </thead>
      <tbody className="text-[11px] divide-y divide-slate-200">
        {sorted.map(mov => (
          <tr key={mov.ordinal} className={mov.requiereRevision ? 'bg-amber-50' : ''}>
            <td className="p-2 pl-3 whitespace-nowrap">
              {editable && onEdit ? (
                <input
                  value={mov.fecha ?? ''}
                  onChange={(e) => onEdit(mov.ordinal, 'fecha', e.target.value)}
                  className="w-24 border border-slate-200 rounded p-1 text-[11px]"
                />
              ) : (
                <span className="text-slate-600">{mov.fecha}</span>
              )}
            </td>
            <td className="p-2 max-w-[160px]">
              {editable && onEdit ? (
                <input
                  value={mov.descripcion ?? ''}
                  onChange={(e) => onEdit(mov.ordinal, 'descripcion', e.target.value)}
                  className="w-full border border-slate-200 rounded p-1 text-[11px]"
                />
              ) : (
                <span className="truncate block" title={mov.descripcion}>{mov.descripcion}</span>
              )}
            </td>
            <td className="p-2 text-right">
              {editable && onEdit ? (
                <input
                  value={mov.debito != null ? formatNumber(mov.debito) : ''}
                  onChange={(e) => onEdit(mov.ordinal, 'debito', e.target.value)}
                  className={cellCls}
                  placeholder="0.00"
                />
              ) : (
                mov.debito != null ? formatCurrency(mov.debito) : '—'
              )}
            </td>
            <td className="p-2 text-right">
              {editable && onEdit ? (
                <input
                  value={mov.credito != null ? formatNumber(mov.credito) : ''}
                  onChange={(e) => onEdit(mov.ordinal, 'credito', e.target.value)}
                  className={cellCls}
                  placeholder="0.00"
                />
              ) : (
                mov.credito != null ? formatCurrency(mov.credito) : '—'
              )}
            </td>
            <td className="p-2 text-right font-semibold">
              {editable && onEdit ? (
                <input
                  value={mov.saldo != null ? formatNumber(mov.saldo) : ''}
                  onChange={(e) => onEdit(mov.ordinal, 'saldo', e.target.value)}
                  className={cellCls}
                  placeholder="0.00"
                />
              ) : (
                formatCurrency(mov.saldo)
              )}
            </td>
            <td className="p-2 text-center relative group">
              {mov.requiereRevision ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap cursor-help">
                  ⚠ Revisión
                </span>
              ) : (
                <span className="text-slate-300 text-[9px]">—</span>
              )}
              {mov.revisionMotivo && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="bg-slate-800 text-white text-[10px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-[300px] text-left">
                    {mov.revisionMotivo}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                </div>
              )}
            </td>
            {editable && onDelete && (
              <td className="p-2 text-center">
                <button
                  onClick={() => onDelete(mov.ordinal)}
                  className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                  title="Eliminar este movimiento"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
