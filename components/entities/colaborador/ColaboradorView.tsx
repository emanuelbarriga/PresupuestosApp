'use client';

import { Shield, User, Pencil } from 'lucide-react';
import clsx from 'clsx';

interface ColaboradorViewProps {
  email: string;
  memberships: Array<{
    companyId: string;
    companyName: string;
    role: string;
    blocked?: boolean;
  }>;
  onEdit: () => void;
}

export function ColaboradorView({ email, memberships, onEdit }: ColaboradorViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle del Colaborador</p>
        <button onClick={onEdit}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
          <Pencil size={12} /> Editar
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email</p>
        <p className="text-sm text-slate-800">{email}</p>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Acceso a empresas</p>
        {memberships.length === 0 ? (
          <p className="text-xs text-slate-400">Sin empresas asignadas</p>
        ) : (
          <div className="space-y-2">
            {memberships.map((m) => (
              <div key={m.companyId}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{m.companyName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold',
                      m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
                    )}>
                      {m.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                      {m.role === 'admin' ? 'Admin' : 'Colaborador'}
                    </span>
                    {m.blocked && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">Bloqueado</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
