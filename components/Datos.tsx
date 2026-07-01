'use client'

import React, { useState } from 'react';
import { Transaction } from '@/lib/types';
import { ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import clsx from 'clsx';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

type TabType = 'Transacciones' | 'Proyectos' | 'Clientes' | 'Proveedores';

export function Datos({ transactions }: { transactions: Transaction[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('Transacciones');

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const tabs: TabType[] = ['Transacciones', 'Proyectos', 'Clientes', 'Proveedores'];

  // Extract unique items
  const proyectosUnicos = Array.from(new Set(transactions.map(t => t.proyectoAsignado))).map(p => {
    const txs = transactions.filter(t => t.proyectoAsignado === p);
    return {
      nombre: p,
      estado: txs[0]?.estadoProyecto || 'N/A',
      transacciones: txs.length,
      presupuestado: txs.reduce((sum, t) => sum + t.montoPresupuestado, 0)
    }
  });

  const entidadesUnicas = Array.from(new Set(transactions.map(t => t.clienteOProveedor))).map(e => {
    const txs = transactions.filter(t => t.clienteOProveedor === e);
    return {
      nombre: e,
      transacciones: txs.length,
      presupuestado: txs.reduce((sum, t) => sum + t.montoPresupuestado, 0)
    }
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Base de Datos</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Gestión integral de registros</p>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab}
              className={clsx("px-4 py-1 text-xs font-medium rounded-md transition-colors", activeTab === tab ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>
      
      <div className="p-4 flex-1 overflow-auto">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col shrink-0">
          
          {activeTab === 'Transacciones' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10"></th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">ID</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Descripción</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Proyecto</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Cliente/Proveedor</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Tipo</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Mes Presup.</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Monto Presup.</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isExpanded = expandedRows.has(tx.id);
                    return (
                      <React.Fragment key={tx.id}>
                        <tr 
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => toggleRow(tx.id)}
                        >
                          <td className="p-3 text-slate-400">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td className="p-3 font-semibold text-slate-700">{tx.id}</td>
                          <td className="p-3 text-slate-600">{tx.descripcion}</td>
                          <td className="p-3 text-slate-600">{tx.proyectoAsignado}</td>
                          <td className="p-3 text-slate-500">{tx.clienteOProveedor}</td>
                          <td className="p-3">
                            <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", tx.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                              {tx.tipo}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{tx.mesPresupuestado}</td>
                          <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(tx.montoPresupuestado)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={8} className="p-0 border-t border-slate-100">
                              <div className="px-12 py-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                                  <Receipt size={14} /> Ejecuciones
                                </p>
                                {tx.ejecuciones.length > 0 ? (
                                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm inline-block min-w-[300px]">
                                    <table className="w-full text-[11px]">
                                      <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                          <th className="p-2 text-left font-bold text-slate-500 px-4">Fecha</th>
                                          <th className="p-2 text-right font-bold text-slate-500 px-4">Monto</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {tx.ejecuciones.map((ej, i) => (
                                          <tr key={i}>
                                            <td className="p-2 px-4 text-slate-600">{ej.fechaEjecutado}</td>
                                            <td className="p-2 px-4 text-right text-slate-800 font-medium">{formatCurrency(ej.montoEjecutado)}</td>
                                          </tr>
                                        ))}
                                        <tr className="bg-slate-50/50">
                                          <td className="p-2 px-4 text-slate-500 font-bold">Total Ejecutado</td>
                                          <td className="p-2 px-4 text-right text-slate-800 font-bold">
                                            {formatCurrency(tx.ejecuciones.reduce((sum, ej) => sum + ej.montoEjecutado, 0))}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500 italic">No hay ejecuciones registradas.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Proyectos' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre del Proyecto</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Estado Actual</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Transacciones</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Monto Involucrado</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] divide-y divide-slate-100">
                  {proyectosUnicos.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-700">{p.nombre}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600">{p.estado}</span>
                      </td>
                      <td className="p-3 text-center text-slate-600 font-medium">{p.transacciones}</td>
                      <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(p.presupuestado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(activeTab === 'Clientes' || activeTab === 'Proveedores') && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase">Nombre de Entidad</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-center">Transacciones</th>
                    <th className="p-3 text-[10px] font-bold text-slate-400 uppercase text-right">Volumen Presupuestado</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] divide-y divide-slate-100">
                  {entidadesUnicas.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-700">{e.nombre}</td>
                      <td className="p-3 text-center text-slate-600 font-medium">{e.transacciones}</td>
                      <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(e.presupuestado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
