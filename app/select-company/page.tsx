'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { subscribeUserCompanies, subscribeInvitations } from '@/lib/firestore';
import type { Company, Invitacion } from '@/lib/types';
import Link from 'next/link';

export default function SelectCompanyPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [invitations, setInvitations] = useState<Invitacion[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    setDataLoading(true);

    const unsubCompanies = subscribeUserCompanies(
      user.uid,
      (data) => {
        setCompanies(data);
        setDataLoading(false);
      },
      () => setDataLoading(false),
    );

    const unsubInvitations = user.email
      ? subscribeInvitations(
          user.email,
          (data) => {
            setInvitations(data);
          },
          () => {},
        )
      : undefined;

    return () => {
      unsubCompanies();
      unsubInvitations?.();
    };
  }, [user]);

  const handleAccept = async (invitationId: string) => {
    if (!user) return;
    setAcceptingId(invitationId);
    setAcceptError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/companies/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invitationId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAcceptError(body.error || 'Error al aceptar la invitación');
        return;
      }

      // On success: subscription updates automatically via real-time
    } catch {
      setAcceptError('Error de conexión. Verificá tu internet e intentá de nuevo');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading || !user) return null;

  const hasContent = companies.length > 0 || invitations.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-800">Gestor de Presupuestos</h1>
        <button
          onClick={handleLogout}
          className="text-xs font-bold text-slate-500 hover:text-red-600 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-12">
        {dataLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Tus empresas */}
            {companies.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  Tus empresas
                </h2>
                <div className="space-y-2">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => router.push(`/${company.id}/dashboard`)}
                      className="w-full text-left bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl px-5 py-4 transition-all"
                    >
                      <p className="text-sm font-bold text-slate-800">{company.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{company.id}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Invitaciones pendientes */}
            {invitations.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  Invitaciones pendientes
                </h2>
                <div className="space-y-2">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{inv.companyName}</p>
                        <p className="text-[11px] text-slate-400">
                          Colaborador · {inv.companyId}
                        </p>
                      </div>
                      <button
                        onClick={() => inv.id && handleAccept(inv.id)}
                        disabled={acceptingId === inv.id}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        {acceptingId === inv.id ? (
                          <>
                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                            Aceptando...
                          </>
                        ) : (
                          'Aceptar'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {acceptError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {acceptError}
              </p>
            )}

            {/* Empty state */}
            {!hasContent && (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500 mb-6">
                  Todavía no tenés empresas ni invitaciones pendientes.
                </p>
              </div>
            )}

            {/* Create company */}
            <div className="pt-2">
              <button
                onClick={() => router.push('/onboarding')}
                className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl py-4 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-all"
              >
                + Crear nueva empresa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
