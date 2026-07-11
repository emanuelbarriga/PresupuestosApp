'use client'

import { useAuth } from '@/context/AuthContext';
import { CompanyProvider } from '@/context/CompanyContext';

export function CompanyProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // CompanyProvider ahora deriva companyId de usePathname() internamente
  // Solo le pasamos userId (puede ser null para rutas sin auth)
  return (
    <CompanyProvider userId={user?.uid ?? null}>
      {children}
    </CompanyProvider>
  );
}
