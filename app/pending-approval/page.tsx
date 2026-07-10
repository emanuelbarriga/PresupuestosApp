'use client'

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function PendingApprovalPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Clock size={28} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Registro completado</h1>
        <p className="text-sm text-slate-500 mb-6">
          Tu cuenta fue creada exitosamente. El administrador te asignará a una empresa próximamente.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-amber-700 font-medium">Estado: Pendiente de asignación</p>
          <p className="text-[11px] text-amber-600 mt-1">
            Vas a poder acceder a la plataforma una vez que el administrador te asigne a una empresa.
          </p>
        </div>
        <button
          onClick={signOut}
          className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg py-2.5 text-xs font-bold transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
