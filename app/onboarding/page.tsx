'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getUserCompaniesSnapshot } from '@/lib/firestore';

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guardChecked, setGuardChecked] = useState(false);

  // Guard: redirect to /select-company if user already has companies
  useEffect(() => {
    if (authLoading || !user) return;

    getUserCompaniesSnapshot(user.uid)
      .then((companies) => {
        if (companies.length > 0) {
          router.replace('/select-company');
        } else {
          setGuardChecked(true);
        }
      })
      .catch(() => {
        setGuardChecked(true);
      });
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!companyName.trim()) {
      setError('El nombre de la empresa es obligatorio');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/companies/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setError('Ya existe una empresa con ese nombre');
        } else {
          setError(body.error || 'Error al crear la empresa. Intenta de nuevo');
        }
        return;
      }

      const { companyId } = await res.json();
      router.push(`/${companyId}/dashboard`);
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user || !guardChecked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-2 text-center">
          Crea tu primera empresa
        </h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Empezá a gestionar tus presupuestos
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Nombre de la empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ej: Mi Empresa S.A.S."
              required
              autoFocus
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
            {isSubmitting ? 'Creando empresa...' : 'Crear empresa'}
          </button>
        </form>
      </div>
    </div>
  );
}
