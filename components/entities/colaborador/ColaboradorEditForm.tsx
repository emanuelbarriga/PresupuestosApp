'use client';

import { useState } from 'react';
import { Mail, Shield, User } from 'lucide-react';
import clsx from 'clsx';

interface UserMembership {
  companyId: string;
  companyName: string;
  role: string;
  active: boolean;
  isNew?: boolean;
}

interface ColaboradorEditFormProps {
  record: {
    userId: string;
    email: string;
    memberships: { companyId: string; companyName: string; role: string; blocked?: boolean }[];
  };
  allCompanies: any[];
  saving: boolean;
  onSave: (memberships: UserMembership[], originalMemberships: any[]) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}

export function ColaboradorEditForm({
  record,
  allCompanies,
  saving,
  onSave,
  onBack,
}: ColaboradorEditFormProps) {
  const currentCompanyIds = new Set(record.memberships.map((m) => m.companyId));
  const [memberships, setMemberships] = useState<UserMembership[]>(
    record.memberships.map((m) => ({ ...m, active: !m.blocked })),
  );
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const availableCompanies = allCompanies.filter((c: any) => !currentCompanyIds.has(c.id));

  const toggleMembership = (companyId: string) => {
    setMemberships((prev) =>
      prev.map((m) => (m.companyId === companyId ? { ...m, active: !m.active } : m)),
    );
  };

  const addCompany = (companyId: string, companyName: string) => {
    setMemberships((prev) => [
      ...prev,
      { companyId, companyName, role: 'colaborador', active: true, isNew: true },
    ]);
  };

  const handleSave = async () => {
    setLocalSaving(true);
    setError('');
    try {
      await onSave(memberships, record.memberships);
      setSuccess(true);
      setTimeout(() => onBack(), 1000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar los cambios');
    } finally {
      setLocalSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Shield size={22} className="text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">¡Permisos actualizados!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Email display */}
      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <Mail size={18} className="text-indigo-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{record.email}</p>
          <p className="text-[10px] text-slate-500">Colaborador</p>
        </div>
      </div>

      {/* Memberships */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Acceso a empresas</label>
        {memberships.length === 0 && <p className="text-xs text-slate-400 py-2">Sin empresas asignadas</p>}
        <div className="space-y-2">
          {memberships.map((m) => (
            <div key={m.companyId}
              className={clsx(
                'flex items-center justify-between p-3 rounded-lg transition-colors border',
                m.isNew ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50',
              )}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{m.companyName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {m.isNew && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Nueva</span>}
                  <button type="button" onClick={() => {
                    setMemberships((prev) =>
                      prev.map((item) =>
                        item.companyId === m.companyId
                          ? { ...item, role: item.role === 'admin' ? 'colaborador' : 'admin' }
                          : item,
                      ),
                    );
                  }}
                    className={clsx(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer hover:opacity-80',
                      m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
                    )}
                    title="Cambiar rol">
                    {m.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                    {m.role === 'admin' ? 'Admin' : 'Colaborador'}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => toggleMembership(m.companyId)}
                className={clsx(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  m.active ? 'bg-indigo-600' : 'bg-slate-300',
                )}
                role="switch" aria-checked={m.active}>
                <span className={clsx(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  m.active ? 'translate-x-4' : 'translate-x-0',
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Agregar a otras empresas */}
      {availableCompanies.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Agregar a otras empresas</label>
          <div className="space-y-1.5 max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2">
            {availableCompanies.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <span className="text-sm text-slate-700">{c.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => addCompany(c.id, c.name)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                    title="Agregar como Colaborador"
                  >
                    + Colab
                  </button>
                  <button
                    onClick={() => {
                      setMemberships((prev) => [
                        ...prev,
                        { companyId: c.id, companyName: c.name, role: 'admin', active: true, isNew: true },
                      ]);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                    title="Agregar como Admin"
                  >
                    + Admin
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-xs font-medium text-rose-700">{error}</p>
        </div>
      )}

      <div className="pt-2">
        <button onClick={handleSave} disabled={saving || localSaving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving || localSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
