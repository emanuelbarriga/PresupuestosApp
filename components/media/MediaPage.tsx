'use client'

import { useState, useEffect, useCallback } from 'react';
import type { NavScreen, TipoDocumentoMedio } from '@/lib/types';
import { Inbox, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { InboxTab } from './InboxTab';
import { ArchivadorTab } from './ArchivadorTab';

interface MediaPageProps {
  companyId: string;
  onNavigate?: (screen: NavScreen) => void;
}

function formatCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MediaPage({ companyId, onNavigate }: MediaPageProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'archivador'>('inbox');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [activeCategory, setActiveCategory] = useState<TipoDocumentoMedio>('factura_venta');

  // Hydration fix: set current month only on client (avoids SSR/CSR mismatch)
  useEffect(() => {
    setSelectedPeriod(formatCurrentMonth());
  }, []);

  // Elegant disappearance callback — called after saving a document from Archivador
  // Checks if the updated values still match the current filter; if not, shows toast
  const handleDocumentoUpdated = useCallback((
    _docId: string,
    newPeriodo: string,
    newTipo: TipoDocumentoMedio,
  ) => {
    if (activeTab !== 'archivador') return;

    if (newPeriodo !== selectedPeriod) {
      toast(`Documento movido a ${newPeriodo}`);
    } else if (newTipo !== activeCategory) {
      toast(`Documento reclasificado a ${newTipo}`);
    }
    // If both match, no toast — sidepanel closes normally
  }, [activeTab, selectedPeriod, activeCategory]);

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">Medios / Archivos</h1>
      </header>
      <div className="border-b border-slate-200 px-6 flex gap-0 bg-white shrink-0">
        <button
          className={`px-4 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'inbox' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('inbox')}
        >
          <Inbox size={16} />
          Inbox
          {activeTab === 'inbox' && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
        <button
          className={`px-4 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'archivador' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('archivador')}
        >
          <Archive size={16} />
          Archivador
          {activeTab === 'archivador' && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'inbox' ? (
          <InboxTab companyId={companyId} onNavigate={onNavigate} />
        ) : (
          <ArchivadorTab
            companyId={companyId}
            selectedPeriod={selectedPeriod}
            activeCategory={activeCategory}
            onPeriodChange={setSelectedPeriod}
            onCategoryChange={setActiveCategory}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </>
  );
}
