'use client';

import { useState } from 'react';
import { Mail, Send } from 'lucide-react';

interface InvitacionCreateFormProps {
  currentUser: any;
  companies: any[];
  selectedCompany: any;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onCreateInvitation: (data: any) => Promise<string | void>;
  onSuccess: () => Promise<void>;
  onBack: () => void;
}

export function InvitacionCreateForm({
  currentUser,
  companies,
  selectedCompany,
  saving,
  setSaving,
  onCreateInvitation,
  onSuccess,
  onBack,
}: InvitacionCreateFormProps) {
  const [email, setEmail] = useState('');
  const [expiry, setExpiry] = useState<1 | 3 | 7>(7);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) return;
    if (!currentUser) return;
    setSaving(true);
    setError('');
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiry);

      await onCreateInvitation({
        email: email.trim(),
        status: 'pendiente',
        invitedBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      setSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al crear la invitación');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Send size={22} className="text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">¡Invitación enviada!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Email */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo electrónico *</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colaborador@ejemplo.com"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            autoFocus
          />
        </div>
      </div>

      {/* Expiración */}
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

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
      )}

      <div className="pt-2">
        <button onClick={handleSubmit}
          disabled={saving || !email.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2">
          <Send size={14} />
          {saving ? 'Guardando...' : 'Enviar invitación'}
        </button>
      </div>
    </div>
  );
}
