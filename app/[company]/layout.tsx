'use client'

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { getUserCompaniesSnapshot } from '@/lib/firestore';
import { CompanyProvider } from '@/context/CompanyContext';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = params.company as string;

  const [membershipState, setMembershipState] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Auth not ready yet — wait
    if (authLoading) return;

    // No user at all → redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // Special case: 'all' company (conjunto mode) — allow without membership
    if (companyId === 'all') {
      setMembershipState('granted');
      return;
    }

    // Check membership in this company
    // We use a one-time snapshot for the guard (not real-time subscription)
    const checkMembership = async () => {
      try {
        const snapshot = await getUserCompaniesSnapshot(user.uid);
        const matchingCompany = snapshot.find(c => c.id === companyId);
        if (matchingCompany) {
          // Also fetch the specific role for this company
          // For now, derive from membership existence
          setUserRole('admin'); // Will be refined when CompanyContext is extended
          setMembershipState('granted');
        } else {
          setMembershipState('denied');
          // Redirect after a brief delay to show a message
          setTimeout(() => router.replace('/select-company'), 2000);
        }
      } catch (err) {
        console.error('Membership check failed:', err);
        setMembershipState('denied');
        setTimeout(() => router.replace('/select-company'), 2000);
      }
    };

    checkMembership();
  }, [user, authLoading, companyId, router]);

  // Auth still loading
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // No user (about to redirect)
  if (!user) return null;

  // Checking membership
  if (membershipState === 'loading') {
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

  // Access granted — render the app with CompanyProvider
  return (
    <CompanyProvider companyId={companyId} userRole={userRole}>
      {children}
    </CompanyProvider>
  );
}
