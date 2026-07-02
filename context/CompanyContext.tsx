'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from '@/lib/types';
import { subscribeCompanies } from '@/lib/firestore';
import { Building2 } from 'lucide-react';

export type CompanyMode = 'individual' | 'conjunto';

interface CompanyContextValue {
  selectedCompany: Company | null;
  companies: Company[];
  mode: CompanyMode;
  setCompany: (id: string) => void;
  setMode: (mode: CompanyMode) => void;
  isConjunto: boolean;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({
  children,
  companyId,
}: {
  children: ReactNode;
  companyId: string;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [mode, setMode] = useState<CompanyMode>(companyId === 'all' ? 'conjunto' : 'individual');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeCompanies(
      (data) => {
        setCompanies(data);

        if (data.length === 0) {
          setSelectedCompany(null);
          setReady(true);
          return;
        }

        if (companyId === 'all') {
          setSelectedCompany(null);
          setMode('conjunto');
        } else {
          const found = data.find((c) => c.id === companyId);
          setSelectedCompany(found || data[0]);
          setMode('individual');
        }
        setReady(true);
      },
      (err) => {
        console.error('Error loading companies:', err);
        setReady(true);
      },
    );

    return () => unsub();
  }, [companyId]);

  const handleSetCompany = (id: string) => {
    const company = companies.find((c) => c.id === id);
    if (company) {
      setSelectedCompany(company);
      setMode('individual');
    }
  };

  const handleSetMode = (newMode: CompanyMode) => {
    setMode(newMode);
    if (newMode === 'conjunto') {
      setSelectedCompany(null);
    } else if (companies.length > 0 && !selectedCompany) {
      setSelectedCompany(companies[0]);
    }
  };

  if (!ready) return null;

  if (companies.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <Building2 size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sin empresas</h2>
          <p className="text-sm text-slate-500">
            No hay empresas registradas en el sistema. Creá una empresa en Firestore para comenzar.
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'individual' && !selectedCompany) return null;

  return (
    <CompanyContext.Provider
      value={{ 
        selectedCompany, 
        companies, 
        mode,
        setCompany: handleSetCompany, 
        setMode: handleSetMode,
        isConjunto: mode === 'conjunto',
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
