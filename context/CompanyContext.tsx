'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Company, UserRole } from '@/lib/types';
import { subscribeUserCompanies, getUserCompaniesSnapshot } from '@/lib/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Building2 } from 'lucide-react';
import { useCompanyStore } from '@/stores/companyStore';

export type CompanyMode = 'individual' | 'conjunto';

interface CompanyContextValue {
  selectedCompany: Company | null;
  companies: Company[];
  userRole: UserRole | null;
  roleLoading: boolean;
  mode: CompanyMode;
  setCompany: (id: string) => void;
  setMode: (mode: CompanyMode) => void;
  isConjunto: boolean;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Derivar companyId del pathname
  const companyId = pathname.split('/')[1] || '';

  // Rutas públicas que NO tienen companyId (no requieren membership ni datos de empresa)
  const PUBLIC_ROUTES = ['login', 'register', 'select-company', 'onboarding', 'pending-approval', ''];
  const isCompanyRoute = PUBLIC_ROUTES.indexOf(companyId) === -1;

  // --- Membership guard states ---
  const [membershipState, setMembershipState] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [membershipUserRole, setMembershipUserRole] = useState<string | null>(null);
  const [membershipChecked, setMembershipChecked] = useState(false);

  // --- Company data states ---
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [mode, setMode] = useState<CompanyMode>('individual');
  const [ready, setReady] = useState(false);

  // --- MEMBERSHIP GUARD (solo para rutas de empresa) ---
  useEffect(() => {
    // Rutas sin empresa: saltar el guard por completo
    if (!isCompanyRoute) {
      setMembershipState('granted');
      setMembershipChecked(true);
      return;
    }

    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Caso especial: 'all' (modo conjunto) — permitir sin membership check
    if (companyId === 'all') {
      setMembershipState('granted');
      setMembershipChecked(true);
      return;
    }

    const checkMembership = async () => {
      try {
        const snapshot = await getUserCompaniesSnapshot(user.uid);
        const matchingCompany = snapshot.find(c => c.id === companyId);
        if (matchingCompany) {
          // Fetch members doc para verificar blocked status y obtener rol
          try {
            const memberSnap = await getDoc(doc(db, 'companies', companyId, 'members', user.uid));
            const memberData = memberSnap.data();
            if (memberData?.blocked === true) {
              setMembershipState('denied');
              setTimeout(() => router.replace('/select-company'), 2000);
              setMembershipChecked(true);
              return;
            }
            const role = memberData?.role ?? 'colaborador';
            setMembershipUserRole(role);
            useCompanyStore.getState().setUserRole(role as UserRole);
          } catch {
            setMembershipUserRole('colaborador'); // fallback — safer to deny
            useCompanyStore.getState().setUserRole('colaborador' as UserRole);
          }
          setMembershipState('granted');
          setMembershipChecked(true);
        } else {
          setMembershipState('denied');
          setTimeout(() => router.replace('/select-company'), 2000);
          setMembershipChecked(true);
        }
      } catch (err) {
        console.error('Membership check failed:', err);
        setMembershipState('denied');
        setTimeout(() => router.replace('/select-company'), 2000);
        setMembershipChecked(true);
      }
    };

    checkMembership();
  }, [user, authLoading, companyId, isCompanyRoute, router]);

  // --- COMPANY DATA SUBSCRIPTION (solo cuando membership está granted) ---
  useEffect(() => {
    // Rutas sin empresa: no cargar datos de compañías
    if (!isCompanyRoute) {
      setCompanies([]);
      setSelectedCompany(null);
      useCompanyStore.getState().setCompanies([]);
      useCompanyStore.getState().setSelectedCompany(null);
      setReady(true);
      return;
    }

    // No userId o membership denegada
    if (!userId || membershipState === 'denied') {
      if (!userId) {
        setCompanies([]);
        setSelectedCompany(null);
        useCompanyStore.getState().setCompanies([]);
        useCompanyStore.getState().setSelectedCompany(null);
        setReady(true);
      }
      return;
    }

    // No empezar la subscripción hasta que membership esté resuelta
    if (membershipState !== 'granted' || !membershipChecked) return;

    const unsub = subscribeUserCompanies(
      userId,
      (data) => {
        setCompanies(data);
        useCompanyStore.getState().setCompanies(data);

        if (data.length === 0) {
          setSelectedCompany(null);
          useCompanyStore.getState().setSelectedCompany(null);
          setReady(true);
          return;
        }

        if (companyId === 'all') {
          setSelectedCompany(null);
          setMode('conjunto');
          useCompanyStore.getState().setSelectedCompany(null);
          useCompanyStore.getState().setMode('conjunto');
        } else {
          const found = data.find((c) => c.id === companyId);
          setSelectedCompany(found || data[0]);
          setMode('individual');
          useCompanyStore.getState().setSelectedCompany(found || data[0]);
          useCompanyStore.getState().setMode('individual');
        }
        setReady(true);
      },
      (err) => {
        console.error('Error loading companies:', err);
        setReady(true);
      },
    );

    return () => unsub();
  }, [companyId, userId, isCompanyRoute, membershipState, membershipChecked]);

  // Determinar el userRole efectivo
  const effectiveRole = membershipUserRole ?? (null as UserRole | null);

  const handleSetCompany = (id: string) => {
    const company = companies.find((c) => c.id === id);
    if (company) {
      setSelectedCompany(company);
      setMode('individual');
      useCompanyStore.getState().setSelectedCompany(company);
      useCompanyStore.getState().setMode('individual');
    }
  };

  const handleSetMode = (newMode: CompanyMode) => {
    setMode(newMode);
    useCompanyStore.getState().setMode(newMode);
    if (newMode === 'conjunto') {
      setSelectedCompany(null);
      useCompanyStore.getState().setSelectedCompany(null);
    } else if (companies.length > 0 && !selectedCompany) {
      setSelectedCompany(companies[0]);
      useCompanyStore.getState().setSelectedCompany(companies[0]);
    }
  };

  // --- RENDER LOGIC ---

  // Rutas sin empresa: pasar children con contexto vacío (sin empresa seleccionada)
  if (!isCompanyRoute) {
    return (
      <CompanyContext.Provider
        value={{
          selectedCompany: null,
          companies: [],
          userRole: null,
          roleLoading: false,
          mode: 'individual',
          setCompany: handleSetCompany,
          setMode: handleSetMode,
          isConjunto: false,
        }}
      >
        {children}
      </CompanyContext.Provider>
    );
  }

  // Auth loading (solo en rutas de empresa)
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // No user (about to redirect)
  if (!user) return null;

  // Membership loading
  if (membershipState === 'loading' || !membershipChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Access denied
  if (membershipState === 'denied') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-2">No tenés acceso a esta empresa.</p>
          <p className="text-xs text-slate-400">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  // --- COMPANY DATA LOADING ---
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // No companies
  if (companies.length === 0) {
    const isCollab = effectiveRole === 'colaborador';
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <Building2 size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sin acceso</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {isCollab
              ? 'No tenés acceso a ninguna empresa. Comunicate con el administrador para que te asigne una.'
              : 'No tenés empresas disponibles. Comunicate con un administrador para que te dé acceso.'}
          </p>
          <button
            onClick={() => window.location.href = '/select-company'}
            className="mt-5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            ← Volver al selector de empresas
          </button>
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
        userRole: effectiveRole,
        roleLoading: false,
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
