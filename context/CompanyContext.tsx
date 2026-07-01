'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from '@/lib/types';
import { subscribeCompanies } from '@/lib/firestore';

interface CompanyContextValue {
  selectedCompany: Company;
  companies: Company[];
  setCompany: (id: string) => void;
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeCompanies(
      (data) => {
        setCompanies(data);

        if (data.length === 0) return;

        const found = data.find((c) => c.id === companyId);
        setSelectedCompany(found || data[0]);
        setReady(true);
      },
      (err) => {
        console.error('Error loading companies:', err);
      },
    );

    return () => unsub();
  }, [companyId]);

  const handleSetCompany = (id: string) => {
    const company = companies.find((c) => c.id === id);
    if (company) {
      setSelectedCompany(company);
    }
  };

  if (!ready || !selectedCompany) return null;

  return (
    <CompanyContext.Provider
      value={{ selectedCompany, companies, setCompany: handleSetCompany }}
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
