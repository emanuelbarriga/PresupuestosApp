'use client'

import { SidepanelData, Transaction } from '@/lib/types';
import { X, Calculator, ReceiptText, FileText, Bell, Settings, Filter, Plus, Edit2 } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface SidepanelProps {
  data: SidepanelData | null;
  onClose: () => void;
  onAddTransaction?: (tx: Partial<Transaction>) => void;
  onAddExecution?: (txId: string, ejecucion: { fechaEjecutado: string; montoEjecutado: number }) => void;
}

export function Sidepanel({ data, onClose, onAddTransaction, onAddExecution }: SidepanelProps) {
  const [isAddingTx, setIsAddingTx] = useState(false);
  const [addingEjecucionForTx, setAddingEjecucionForTx] = useState<string | null>(null);

  const [txForm, setTxForm] = useState({
    descripcion: '',
    montoPresupuestado: '',
    clienteOProveedor: ''
  });

  const [ejForm, setEjForm] = useState({
    fechaEjecutado: '',
    montoEjecutado: ''
  });

  useEffect(() => {
    setIsAddingTx(false);
    setAddingEjecucionForTx(null);
    setTxForm({
      descripcion: '',
      montoPresupuestado: '',
      clienteOProveedor: data?.context?.cliente || ''
    });
    setEjForm({
      fechaEjecutado: '',
      montoEjecutado: ''
    });
  }, [data]);

  const handleSaveTx = () => {
    onAddTransaction?.({
      descripcion: txForm.descripcion,
      montoPresupuestado: Number(txForm.montoPresupuestado),
      clienteOProveedor: txForm.clienteOProveedor
    });
    setIsAddingTx(false);
  };

  const handleSaveEj = () => {
    if (addingEjecucionForTx) {
      onAddExecution?.(addingEjecucionForTx, {
        fechaEjecutado: ejForm.fechaEjecutado,
        montoEjecutado: Number(ejForm.montoEjecutado)
      });
      setAddingEjecucionForTx(null);
    }
  };

  return (
    <aside className={clsx(
      "bg-white border-l border-slate-200 flex flex-col h-full transition-all duration-300 ease-out shrink-0 overflow-hidden relative",
      data ? "w-[360px]" : "w-16 items-center py-4"
    )}>
      {!data ? (
        <div className="flex flex-col gap-6 w-full items-center text-slate-400">
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors" title="Exportar">
            <FileText size={20} strokeWidth={2}/>
          </button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors" title="Filtros">
            <Filter size={20} strokeWidth={2}/>
          </button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors" title="Notificaciones">
            <Bell size={20} strokeWidth={2}/>
          </button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors mt-auto" title="Ajustes">
            <Settings size={20} strokeWidth={2}/>
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-full w-[360px] absolute inset-0">
          <div className="p-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">Detalle de Celda</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className={clsx("rounded-xl p-4 border", data.mode === 'Presupuestado' ? "bg-sky-50 border-sky-100 text-sky-900" : "bg-slate-800 border-slate-700 text-white")}>
              <p className={clsx("text-[10px] font-bold uppercase tracking-widest", data.mode === 'Presupuestado' ? "text-sky-600" : "text-slate-400")}>Seleccionado</p>
              <p className="text-sm font-bold mt-1">{data.title}</p>
              <p className="text-xs mt-1 opacity-80">{data.subtitle}</p>
            </div>
          </div>

          {isAddingTx ? (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Nueva Transacción</h3>
              
              {data.context && (
                <div className="mb-6 bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11px] text-slate-600">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-slate-400">Proyecto:</span>
                    <span className="font-bold text-slate-700">{data.context.proyecto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-400">Mes:</span>
                    <span className="font-bold text-slate-700">{data.context.mes}</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descripción</label>
                  <input type="text" value={txForm.descripcion} onChange={e => setTxForm({...txForm, descripcion: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="Ej. Licencias anuales" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto Presupuestado</label>
                  <input type="number" value={txForm.montoPresupuestado} onChange={e => setTxForm({...txForm, montoPresupuestado: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cliente / Proveedor</label>
                  <input type="text" value={txForm.clienteOProveedor} onChange={e => setTxForm({...txForm, clienteOProveedor: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="Nombre" />
                </div>
                <div className="pt-4 flex gap-2">
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded py-2 text-xs font-bold transition-colors" onClick={handleSaveTx}>Guardar</button>
                  <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded py-2 text-xs font-bold transition-colors" onClick={() => setIsAddingTx(false)}>Cancelar</button>
                </div>
              </div>
            </div>
          ) : addingEjecucionForTx ? (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Registrar Ejecución</h3>
              <p className="text-xs text-slate-500 mb-6">Para transacción ID: {addingEjecucionForTx}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de Ejecución</label>
                  <input type="date" value={ejForm.fechaEjecutado} onChange={e => setEjForm({...ejForm, fechaEjecutado: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto Ejecutado</label>
                  <input type="number" value={ejForm.montoEjecutado} onChange={e => setEjForm({...ejForm, montoEjecutado: e.target.value})} className="w-full border border-slate-200 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="0.00" />
                </div>
                <div className="pt-4 flex gap-2">
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded py-2 text-xs font-bold transition-colors" onClick={handleSaveEj}>Guardar</button>
                  <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded py-2 text-xs font-bold transition-colors" onClick={() => setAddingEjecucionForTx(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Transacciones ({data.transactions.length})</p>
                  <button 
                    onClick={() => setIsAddingTx(true)}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors uppercase"
                  >
                    <Plus size={12} /> Nueva
                  </button>
                </div>
                
                <div className="space-y-4">
                  {data.transactions.map((tx) => (
                    <div key={tx.id} className="group flex justify-between items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0 hover:bg-slate-50 p-2 -mx-2 rounded transition-colors cursor-pointer" onClick={() => data.mode === 'Presupuestado' && setAddingEjecucionForTx(tx.id)}>
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-700 leading-tight group-hover:text-indigo-600 transition-colors">{tx.descripcion}</p>
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600" title="Editar" onClick={(e) => { e.stopPropagation(); setIsAddingTx(true); }}>
                            <Edit2 size={12} />
                          </button>
                          {data.mode === 'Presupuestado' && (
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600" title="Agregar Ejecución" onClick={(e) => { e.stopPropagation(); setAddingEjecucionForTx(tx.id); }}>
                              <Plus size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">ID: {tx.id} • {tx.proyectoAsignado}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-800">
                          {data.mode === 'Presupuestado' ? formatCurrency(tx.montoPresupuestado) : formatCurrency(tx.ejecuciones.reduce((s, ej) => s + ej.montoEjecutado, 0))}
                        </p>
                        <span className={clsx("text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 mt-1 inline-block", tx.tipo === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                          {tx.tipo}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {data.transactions.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">No hay transacciones asociadas a esta celda.</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl mt-auto border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Fórmula de Selección</p>
                </div>
                <p className="text-[11px] text-slate-600 italic leading-relaxed">{data.formula}</p>
              </div>
            </div>
          )}

          <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 uppercase font-semibold">Presupuestado</span>
              <span className="text-slate-700 font-bold">{formatCurrency(data.presupuestado)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 uppercase font-semibold">Ejecutado</span>
              <span className="text-slate-700 font-bold">{formatCurrency(data.ejecutado)}</span>
            </div>
            <div className="h-px bg-slate-200 w-full my-1"></div>
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-slate-700 uppercase text-[10px] tracking-wider">Diferencia</span>
              <span className={clsx("font-black text-lg", data.diferencia === 0 ? "text-slate-400" : (data.diferencia > 0 ? "text-emerald-600" : "text-rose-600"))}>
                {data.diferencia > 0 ? '+' : ''}{formatCurrency(data.diferencia)}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
