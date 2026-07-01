'use client'

import { useState } from 'react';
import { ViewType, SidepanelData, Transaction } from '@/lib/types';
import { mockTransactions } from '@/lib/mockData';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Datos } from '@/components/Datos';
import { Construction } from '@/components/Construction';
import { Sidepanel } from '@/components/Sidepanel';

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('Dashboard');
  const [sidepanelData, setSidepanelData] = useState<SidepanelData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);

  const handleViewChange = (view: ViewType) => {
    setActiveView(view);
    if (view !== 'Dashboard') {
      setSidepanelData(null);
    }
  };

  const handleSidebarToggle = () => {
    const newCollapsedState = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsedState);
    if (!newCollapsedState) {
      // If we are expanding the sidebar, hide the active sidepanel
      setSidepanelData(null);
    }
  };

  const handleCellClick = (data: SidepanelData) => {
    setSidepanelData(data);
    // Auto-collapse sidebar when sidepanel becomes active
    setSidebarCollapsed(true);
  };

  const handleSidepanelClose = () => {
    setSidepanelData(null);
    // Automatically expand the sidebar when sidepanel is closed
    setSidebarCollapsed(false);
  };

  const handleAddTransaction = (tx: Partial<Transaction>) => {
    const newTx: Transaction = {
      id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
      descripcion: tx.descripcion || 'Nueva transacción',
      tipo: sidepanelData?.tipo || 'ingreso',
      montoPresupuestado: tx.montoPresupuestado || 0,
      mesPresupuestado: sidepanelData?.context?.mes || 'Enero',
      proyectoAsignado: sidepanelData?.context?.proyecto || tx.proyectoAsignado || '',
      clienteOProveedor: sidepanelData?.context?.cliente || tx.clienteOProveedor || '',
      estadoProyecto: tx.estadoProyecto || 'Activo',
      ejecuciones: []
    };
    
    setTransactions(prev => [...prev, newTx]);
    
    // Update sidepanel data
    if (sidepanelData) {
      setSidepanelData(prev => prev ? {
        ...prev,
        transactions: [...prev.transactions, newTx],
        presupuestado: prev.presupuestado + newTx.montoPresupuestado,
        diferencia: prev.ejecutado - (prev.presupuestado + newTx.montoPresupuestado),
        value: prev.mode === 'Presupuestado' ? prev.value + newTx.montoPresupuestado : prev.value
      } : null);
    }
  };

  const handleAddExecution = (txId: string, ejecucion: { fechaEjecutado: string; montoEjecutado: number }) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id === txId) {
        return {
          ...tx,
          ejecuciones: [...tx.ejecuciones, ejecucion]
        };
      }
      return tx;
    }));
    
    // update sidepanel data
    if (sidepanelData) {
      setSidepanelData(prev => {
        if (!prev) return null;
        const updatedTxs = prev.transactions.map(tx => {
          if (tx.id === txId) {
            return {
              ...tx,
              ejecuciones: [...tx.ejecuciones, ejecucion]
            };
          }
          return tx;
        });
        const extraEjecutado = ejecucion.montoEjecutado;
        return {
          ...prev,
          transactions: updatedTxs,
          ejecutado: prev.ejecutado + extraEjecutado,
          diferencia: prev.ejecutado + extraEjecutado - prev.presupuestado,
          value: prev.mode === 'Ejecutado' ? prev.value + extraEjecutado : prev.value
        }
      });
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F4F6F8] text-slate-900 font-sans overflow-hidden select-none">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={handleSidebarToggle} 
        activeView={activeView} 
        onViewChange={handleViewChange} 
      />
      
      <main className="flex-1 flex overflow-hidden relative min-w-0">
        <div className="flex-1 overflow-hidden flex flex-col bg-transparent">
          {activeView === 'Dashboard' && <Dashboard onCellClick={handleCellClick} transactions={transactions} />}
          {activeView === 'Datos' && <Datos transactions={transactions} />}
          {['Proyectos', 'Proveedores', 'Clientes'].includes(activeView) && (
            <Construction view={activeView} />
          )}
        </div>

        <Sidepanel data={sidepanelData} onClose={handleSidepanelClose} onAddTransaction={handleAddTransaction} onAddExecution={handleAddExecution} />
      </main>
    </div>
  );
}
