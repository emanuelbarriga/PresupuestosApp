'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { User } from 'firebase/auth';

interface CompaniaCreateFormProps {
  user: User | null;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onSubmit: (action: { mode: 'create'; entity: 'compania'; data: Record<string, any> }) => Promise<void>;
  onBack: () => void;
}

export function CompaniaCreateForm({
  user,
  saving,
  setSaving,
  onBack,
}: CompaniaCreateFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdCompanyId, setCreatedCompanyId] = useState('');

  const handleCreate = async () => {
    if (!companyName.trim()) { setError('El nombre de la empresa es obligatorio'); return; }
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/companies/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'Error al crear la empresa'); return; }
      setCreatedCompanyId(body.companyId);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Building2 size={22} className="text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">¡Empresa creada!</p>
        <p className="text-xs text-slate-500 text-center"><strong>{companyName}</strong> fue creada exitosamente.</p>
        <button onClick={() => { window.location.href = `/${createdCompanyId}/dashboard`; }}
          className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 px-6 text-xs font-bold transition-colors">
          Ir a {companyName}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info box */}
      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <Building2 size={18} className="text-indigo-500 shrink-0" />
        <p className="text-xs text-slate-600">Como administrador, podés crear una empresa nueva. Serás el administrador automáticamente.</p>
      </div>

      {/* Company name input */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Nombre de la empresa *</label>
        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Ej: Constructora S.A."
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
          autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
      )}

      <div className="pt-2">
        <button onClick={handleCreate} disabled={saving || !companyName.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Creando...' : 'Crear empresa'}
        </button>
      </div>
    </div>
  );
}
