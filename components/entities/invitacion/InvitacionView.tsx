'use client';

import { Pencil } from 'lucide-react';
import { DF } from '@/components/shared/DF';

interface InvitacionViewProps {
  invitacion: {
    id?: string;
    companyId?: string;
    companyName?: string;
    email?: string;
    role?: string;
    status?: string;
    invitedBy?: string;
    createdAt?: string;
    expiresAt?: string;
  };
  onNavigate: () => void;
}

export function InvitacionView({ invitacion, onNavigate }: InvitacionViewProps) {
  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric',
    }) : '—';

  const roleColors: Record<string, string> = {
    colaborador: 'bg-emerald-100 text-emerald-700',
    admin: 'bg-indigo-100 text-indigo-700',
  };

  const statusColors: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700',
    aceptada: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle de la Invitación</p>
        <button onClick={onNavigate}
          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
          <Pencil size={12} /> Editar
        </button>
      </div>

      <DF label="Empresa" v={invitacion.companyName || '—'} />
      <DF label="Email" v={invitacion.email || '—'} />

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Rol</p>
        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold ${roleColors[invitacion.role || ''] || 'bg-slate-100 text-slate-600'}`}>
          {invitacion.role === 'admin' ? 'Administrador' : 'Colaborador'}
        </span>
      </div>

      <DF label="Expiración" v={formatDate(invitacion.expiresAt)} />

      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estado</p>
        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold ${statusColors[invitacion.status || ''] || 'bg-slate-100 text-slate-600'}`}>
          {invitacion.status || '—'}
        </span>
      </div>
    </div>
  );
}
