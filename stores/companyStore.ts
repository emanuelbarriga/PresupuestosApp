import { create } from 'zustand';
import { Company, UserRole } from '@/lib/types';

export type CompanyMode = 'individual' | 'conjunto';

interface CompanyState {
  selectedCompany: Company | null;
  companies: Company[];
  userRole: UserRole | null;
  roleLoading: boolean;
  mode: CompanyMode;
  isConjunto: boolean;

  setSelectedCompany: (company: Company | null) => void;
  setCompanies: (companies: Company[]) => void;
  setUserRole: (role: UserRole | null) => void;
  setMode: (mode: CompanyMode) => void;
  setRoleLoading: (loading: boolean) => void;
  setCompany: (id: string) => void;
  setModeWithFallback: (mode: CompanyMode, companies: Company[], selectedCompany: Company | null) => void;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  selectedCompany: null,
  companies: [],
  userRole: null,
  roleLoading: false,
  mode: 'individual',
  isConjunto: false,

  setSelectedCompany: (company) => set({ selectedCompany: company, isConjunto: false }),
  setCompanies: (companies) => set({ companies }),
  setUserRole: (role) => set({ userRole: role }),
  setMode: (mode) => set({ mode, isConjunto: mode === 'conjunto' }),
  setRoleLoading: (loading) => set({ roleLoading: loading }),

  setCompany: (id) => {
    const company = get().companies.find((c) => c.id === id);
    if (company) {
      set({ selectedCompany: company, mode: 'individual', isConjunto: false });
    }
  },

  setModeWithFallback: (newMode, companies, selectedCompany) => {
    if (newMode === 'conjunto') {
      set({ mode: 'conjunto', selectedCompany: null, isConjunto: true });
    } else if (companies.length > 0 && !selectedCompany) {
      set({ mode: 'individual', selectedCompany: companies[0], isConjunto: false });
    } else {
      set({ mode: newMode, isConjunto: false });
    }
  },
}));
