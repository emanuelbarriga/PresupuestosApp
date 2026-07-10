'use client';

import { useState } from 'react';
import { Clock, Pencil, Mail } from 'lucide-react';

interface InvitacionEditFormProps {
  record: {
    id?: string;
    email?: string;
    expiresAt?: string;
    createdAt?: string;
  };
  currentUser: any;
  companies: any[];
  selectedCompany: any;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onUpdateInvitation: (id: string, data: { expiresAt?: string }) => Promise<void>;
  onSuccess: () => Promise<void>;
  onBack: () => void;
}

export function InvitacionEditForm({
  record,
  saving,
  setSaving,
  onUpdateInvitation,
  onSuccess,
}: InvitacionEditFormProps) {
  const [expiry, setExpiry] = useState<1 | 3 | 7>(() => {
    if (!record?.expiresAt) return 7;
    const remaining = Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (remaining <= 1) return 1;
    if (remaining <= 3) return 3;
    return 7;
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!record?.id) return;
    setSaving(true);
    setError('');
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiry);
      await onUpdateInvitation(record.id, {
        expiresAt: expiresAt.toISOString(),
      });
      setSuccess(true);
      setTimeout(() => onSuccess(), 1000);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar la invitación');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : '—';

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Pencil size={22} className="text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">¡Invitación actualizada!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Email readonly */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo electrónico</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="email" value={record?.email ?? ''} disabled
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-slate-50 text-slate-500 cursor-not-allowed outline-none" />
        </div>
      </div>

      {/* Expiración editable */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Tiempo disponible</label>
        <div className="flex bg-slate-100 rounded-lg p-1">
          {([1, 3, 7] as const).map((d) => (
            <button key={d} type="button" onClick={() => setExpiry(d)}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                expiry === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {d === 1 ? '1 día' : d === 3 ? '3 días' : '1 semana'}
            </button>
          ))}
        </div>
      </div>

      {/* Created date */}
      {record?.createdAt && (
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Enviada</label>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <Clock size={14} className="text-slate-400 shrink-0" />
            <span className="text-sm text-slate-700">{formatDate(record.createdAt)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
      )}

      <div className="pt-2">
        <button onClick={handleSubmit} disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2">
          <Pencil size={14} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
