'use client';

import { useState, useEffect, useRef } from 'react';
import type { Project, Client, Tercero, Budget, CuentaBancaria, SettingsCategorias, ActiveForm, Comprobante, Month, Banco, MovimientoBancarioInput, ExtractoEstado } from '@/lib/types';
import { MONTHS } from '@/lib/types';
import { subscribeClients, subscribeProviders, subscribeBudgets, subscribeTerceros, subscribeSettings, subscribeCuentasBancarias, addClient, addProject, addTercero, createInvitation, updateInvitation, blockMember, updateMemberRole, addMemberToCompany } from '@/lib/firestore';
import { X, ChevronDown, ChevronUp, Save, Send, Shield, Mail, Clock, User, Pencil, Building2, Plus } from 'lucide-react';
import { formatThousands, unformatThousands } from '@/lib/utils';
import { derivarEstadoComprobantes, REQUIRED_COMPROBANTE_TYPES } from '@/lib/comprobantes';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { Calculator } from '@/components/shared/Calculator';
import { DF } from '@/components/shared/DF';
import { FormInput } from '@/components/forms/FormInput';
import { FormSelect } from '@/components/forms/FormSelect';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { TipoSwitch } from '@/components/forms/TipoSwitch';
import { ColorSelect } from '@/components/forms/ColorSelect';
import { BudgetForm } from '@/components/forms/BudgetForm';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { EjecucionForm } from '@/components/forms/EjecucionForm';
import { TerceroForm } from '@/components/forms/TerceroForm';
import { CuentaForm } from '@/components/forms/CuentaForm';
import { ExtractoAddForm } from '@/components/forms/ExtractoAddForm';
import { FormExtractoEdit } from '@/components/forms/FormExtractoEdit';
import { ComprobanteUploader } from '@/components/upload/ComprobanteUploader';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

// ── Helper type ──

interface PendingComprobante {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  descripcion?: string;
  tipo?: string;
}

// ── Invite User Form Component ──

function InviteUserForm({
  currentUser,
  companies,
  selectedCompany,
  saving,
  setSaving,
  onBack,
  onClose,
  form,
}: {
  currentUser: any;
  companies: any[];
  selectedCompany: any;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onBack: () => void;
  onClose: () => void;
  form?: ActiveForm;
}) {
  const isEdit = form?.mode === 'edit' && form?.type === 'invite-user';
  const record = (isEdit ? (form as any).record : null) as { id?: string; email?: string; role?: string; expiresAt?: string; createdAt?: string; companyName?: string } | null;

  const [inviteEmail, setInviteEmail] = useState(record?.email ?? '');
  const [inviteRole, setInviteRole] = useState<'colaborador' | 'admin'>(
    (record?.role as 'colaborador' | 'admin') ?? 'colaborador',
  );
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(
    selectedCompany ? [selectedCompany.id] : [],
  );
  const [inviteExpiry, setInviteExpiry] = useState<1 | 3 | 7>(() => {
    if (!record?.expiresAt) return 7;
    const remaining = Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (remaining <= 1) return 1;
    if (remaining <= 3) return 3;
    return 7;
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    );
  };

  const handleInvite = async () => {
    if (isEdit && record) {
      setSaving(true);
      setError('');
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + inviteExpiry);
        await updateInvitation(record.id!, {
          role: inviteRole,
          expiresAt: expiresAt.toISOString(),
        });
        setSuccess(true);
        setTimeout(() => onBack(), 1000);
      } catch (err: any) {
        setError(err?.message || 'Error al actualizar la invitación');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!inviteEmail.trim()) return;
    if (selectedCompanies.length === 0) {
      setError('Seleccioná al menos una empresa');
      return;
    }
    if (!currentUser) return;
    setSaving(true);
    setError('');
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + inviteExpiry);

      for (const companyId of selectedCompanies) {
        const company = companies.find((c: any) => c.id === companyId);
        if (!company) continue;

        await createInvitation({
          companyId: company.id,
          companyName: company.name,
          email: inviteEmail.trim(),
          role: inviteRole,
          status: 'pendiente',
          invitedBy: currentUser.uid,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        });
      }
      setSuccess(true);
      setTimeout(() => onBack(), 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al crear la invitación');
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit ? 'Editar invitación' : 'Invitar colaborador';

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {success ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              {isEdit ? <Pencil size={22} className="text-emerald-600" /> : <Send size={22} className="text-emerald-600" />}
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {isEdit ? '¡Invitación actualizada!' : '¡Invitación enviada!'}
            </p>
          </div>
        ) : (
          <>
            {isEdit ? (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Empresa</label>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700">{(record as any)?.companyName ?? '—'}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Empresas *</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                  {companies.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay empresas disponibles</p>
                  ) : (
                    companies.map((company: any) => (
                      <label key={company.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                        <input type="checkbox" checked={selectedCompanies.includes(company.id)} onChange={() => toggleCompany(company.id)} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">{company.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedCompanies.length > 0 && (
                  <p className="text-[10px] text-indigo-600 mt-1">
                    {selectedCompanies.length} empresa{selectedCompanies.length > 1 ? 's' : ''} seleccionada{selectedCompanies.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo electrónico {isEdit ? '' : '*'}</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colaborador@ejemplo.com"
                  disabled={isEdit}
                  className={clsx('w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all', isEdit && 'bg-slate-50 text-slate-500 cursor-not-allowed')}
                  autoFocus={!isEdit} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Rol</label>
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button type="button" onClick={() => setInviteRole('colaborador')}
                  className={clsx('flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5', inviteRole === 'colaborador' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  <User size={14} /> Colaborador
                </button>
                <button type="button" onClick={() => setInviteRole('admin')}
                  className={clsx('flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5', inviteRole === 'admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  <Shield size={14} /> Administrador
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Tiempo disponible</label>
              <div className="flex bg-slate-100 rounded-lg p-1">
                {([1, 3, 7] as const).map(d => (
                  <button key={d} type="button" onClick={() => setInviteExpiry(d)}
                    className={clsx('flex-1 py-2 text-xs font-bold rounded-md transition-all', inviteExpiry === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {d === 1 ? '1 día' : d === 3 ? '3 días' : '1 semana'}
                  </button>
                ))}
              </div>
            </div>

            {isEdit && record?.createdAt && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Enviada</label>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700">{new Date(record.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-xs font-medium text-rose-700">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
      {!success && (
        <div className="p-6 border-t border-slate-100 shrink-0 space-y-2">
          <button onClick={handleInvite} disabled={saving || (!isEdit && (!inviteEmail.trim() || selectedCompanies.length === 0))}
            className={clsx('w-full text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2', isEdit ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400' : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400')}>
            {isEdit ? <Pencil size={14} /> : <Send size={14} />}
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : `Enviar invitación${selectedCompanies.length > 1 ? 'es' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Edit User Role Form ──

interface UserMembership {
  companyId: string;
  companyName: string;
  role: string;
  active: boolean;
  isNew?: boolean;
}

function EditUserRoleForm({
  onBack,
  onClose,
  form,
}: {
  onBack: () => void;
  onClose: () => void;
  form: ActiveForm;
}) {
  const record = (form as any).record as {
    userId: string;
    email: string;
    memberships: { companyId: string; companyName: string; role: string; blocked?: boolean }[];
  };
  const { companies: allCompanies } = useCompany();
  const currentCompanyIds = new Set(record.memberships.map((m) => m.companyId));
  const [memberships, setMemberships] = useState<UserMembership[]>(
    record.memberships.map((m) => ({ ...m, active: !m.blocked })),
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const availableCompanies = allCompanies.filter((c) => !currentCompanyIds.has(c.id));

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
    setSaving(true);
    setError('');
    try {
      const originalMap = new Map(record.memberships.map((om) => [om.companyId, om]));
      for (const m of memberships) {
        const original = originalMap.get(m.companyId);
        if (m.isNew) {
          await addMemberToCompany(m.companyId, record.userId, record.email, m.role);
        } else if (original) {
          if (m.active !== !original.blocked) {
            await blockMember(m.companyId, record.userId, !m.active);
          }
          if (m.role !== original.role) {
            await updateMemberRole(m.companyId, record.userId, m.role);
          }
        }
      }
      setSuccess(true);
      setTimeout(() => onBack(), 1000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title="Gestionar colaborador" canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {success ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Shield size={22} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-700">¡Permisos actualizados!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <Mail size={18} className="text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{record.email}</p>
                <p className="text-[10px] text-slate-500">Colaborador</p>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Acceso a empresas</label>
              {memberships.length === 0 && <p className="text-xs text-slate-400 py-2">Sin empresas asignadas</p>}
              <div className="space-y-2">
                {memberships.map((m) => (
                  <div key={m.companyId}
                    className={clsx('flex items-center justify-between p-3 rounded-lg transition-colors border', m.isNew ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{m.companyName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {m.isNew && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Nueva</span>}
                        <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold', m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700')}>
                          {m.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                          {m.role === 'admin' ? 'Admin' : 'Colaborador'}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleMembership(m.companyId)}
                      className={clsx('relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none', m.active ? 'bg-indigo-600' : 'bg-slate-300')}
                      role="switch" aria-checked={m.active}>
                      <span className={clsx('pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out', m.active ? 'translate-x-4' : 'translate-x-0')} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {availableCompanies.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Agregar a otras empresas</label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {availableCompanies.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <span className="text-sm text-slate-700">{c.name}</span>
                      <button onClick={() => addCompany(c.id, c.name)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors">
                        + Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3"><p className="text-xs font-medium text-rose-700">{error}</p></div>}
          </>
        )}
      </div>
      {!success && (
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create Company Form ──

function CreateCompanyForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
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

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title="Crear empresa" canGoBack={true} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {success ? (
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
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <Building2 size={18} className="text-indigo-500 shrink-0" />
              <p className="text-xs text-slate-600">Como administrador, podés crear una empresa nueva. Serás el administrador automáticamente.</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Nombre de la empresa *</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej: Constructora S.A."
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            </div>
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3"><p className="text-xs font-medium text-rose-700">{error}</p></div>}
          </>
        )}
      </div>
      {!success && (
        <div className="p-6 border-t border-slate-100 shrink-0">
          <button onClick={handleCreate} disabled={saving || !companyName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
            {saving ? 'Creando...' : 'Crear empresa'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── FormPanel ──

interface FormPanelProps {
  form: ActiveForm;
  companyId: string;
  onClose: () => void;
  onSubmit: (f: ActiveForm, d: Record<string, any>) => Promise<void>;
  projects?: Project[];
  onBack: () => void;
  canGoBack: boolean;
}

export function FormPanel({ form, companyId, onClose, onSubmit, projects, onBack, canGoBack }: FormPanelProps) {
  const { user: currentUser } = useAuth();
  const { selectedCompany, companies } = useCompany();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [showNewProjectClient, setShowNewProjectClient] = useState(false);
  const [newProjectClientName, setNewProjectClientName] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [montoEditing, setMontoEditing] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(3);
  const [customTipo, setCustomTipo] = useState('');
  const [customUnidad, setCustomUnidad] = useState('');
  const [settingsData, setSettingsData] = useState<SettingsCategorias | null>(null);
  const [pendingComprobantes, setPendingComprobantes] = useState<PendingComprobante[]>([]);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [selectedBudgetLinks, setSelectedBudgetLinks] = useState<Array<{budgetId: string; budgetName: string; monto: string}>>([]);

  const safeProjects = projects || [];
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);

  useEffect(() => {
    const unsubs = [subscribeClients(setClients), subscribeProviders(setProviders), subscribeTerceros(setTerceros), subscribeBudgets(companyId, setAllBudgets), subscribeCuentasBancarias(companyId, setCuentas), subscribeSettings(setSettingsData)];
    return () => unsubs.forEach(u => u());
  }, [companyId]);

  const clientsAndProviders = [
    ...clients.map(c => ({ value: c.id, label: c.name, type: 'client' as const })),
    ...providers
      .filter(p => !clients.some(c => c.id === p.id))
      .map(p => ({ value: p.id, label: p.name, type: 'provider' as const })),
    { value: '', label: 'Interno', type: 'interno' as const },
  ];

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const newId = await addClient({ name: newClientName.trim() });
    set('entityId', newId);
    set('entityName', newClientName.trim());
    set('entityType', 'client');
    setNewClientName('');
    setShowNewClient(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const newId = await addProject(companyId, { name: newProjectName.trim(), clientName: newProjectClient.trim() || 'Sin cliente', clientId: '', estado: 'Activo' });
    set('projectId', newId);
    set('projectName', newProjectName.trim());
    setNewProjectName('');
    setNewProjectClient('');
    setShowNewProject(false);
  };

  useEffect(() => {
    if (form.mode === 'edit') {
      const init: Record<string, string> = {};
      const r = form.record as any;
      Object.keys(r).forEach(k => { if (k !== 'id' && k !== 'archivado') init[k] = String(r[k] ?? ''); });
      setFields(init);
    } else {
      const init: Record<string, string> = {};
      if (form.type === 'ejecucion') {
        init.tipo = 'ingreso';
        init.fechaEjecutado = new Date().toISOString().split('T')[0];
      } else if (form.type === 'budget') {
        init.tipo = 'ingreso';
      } else if (form.type === 'client' || form.type === 'tercero') {
        init.tipo = 'cliente';
      } else if (form.type === 'provider') {
        init.tipo = 'proveedor';
      } else if (form.type === 'extracto') {
        init.estado = 'Pendiente';
      }
      if (form.defaults) Object.assign(init, form.defaults);
      setFields(init);
    }
  }, [form]);

  useEffect(() => {
    if (form.mode === 'edit' && form.type === 'ejecucion') {
      const c = (form.record as any).comprobantes || [];
      setComprobantes(c);
    } else {
      setComprobantes([]);
      setPendingComprobantes([]);
    }
  }, [form]);

  const set = (k: string, v: string) => setFields(prev => ({ ...prev, [k]: v }));
  const f = (k: string) => fields[k] ?? '';
  const ft = form.mode === 'add' ? form.type : form.type;

  const handleDateChange = (date: string) => {
    set('fechaEjecutado', date);
    if (ft === 'budget' && date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        set('mesPresupuestado', MONTHS[parseInt(parts[1], 10) - 1] || '');
        set('fechaPresupuestado', parts[0] + '-' + parts[1]);
      }
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    if (ft === 'ejecucion' && selectedBudgetLinks.length > 0) {
      const montoEj = Number(f('montoEjecutado')) || 0;
      const totalLinks = selectedBudgetLinks.reduce((s, l) => s + (Number(l.monto) || 0), 0);
      if (Math.abs(montoEj - totalLinks) > 1) {
        setSaving(false);
        alert(`La suma de los montos vinculados (${totalLinks}) no coincide con el monto ejecutado (${montoEj}). Ajustá los montos o eliminá los vínculos.`);
        return;
      }
    }

    const base: Record<string, any> = { ...fields };
    const addMonth = (monthName: string, count: number): string => {
      const idx = MONTHS.indexOf(monthName as Month);
      return MONTHS[(idx + count) % 12];
    };
    const addMonthToDate = (dateStr: string, count: number): string => {
      if (!dateStr) return dateStr;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (m < 1 || m > 12) return dateStr;
      m += count;
      while (m > 12) { m -= 12; y++; }
      while (m < 1) { m += 12; y--; }
      return `${y}-${String(m).padStart(2, '0')}-${parts[2]}`;
    };
    const addMonthToYM = (ymStr: string, count: number): string => {
      if (!ymStr) return ymStr;
      const parts = ymStr.split('-');
      if (parts.length !== 2) return ymStr;
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (m < 1 || m > 12) return ymStr;
      m += count;
      while (m > 12) { m -= 12; y++; }
      while (m < 1) { m += 12; y--; }
      return `${y}-${String(m).padStart(2, '0')}`;
    };

    const ensureFechaPresupuestado = (d: Record<string, any>) => {
      if (d.mesPresupuestado && !d.fechaPresupuestado) {
        const monthIdx = MONTHS.indexOf(d.mesPresupuestado as Month);
        if (monthIdx >= 0) {
          const year = d.fechaEjecutado ? parseInt(d.fechaEjecutado.split('-')[0], 10) : new Date().getFullYear();
          d.fechaPresupuestado = `${isNaN(year) ? new Date().getFullYear() : year}-${String(monthIdx + 1).padStart(2, '0')}`;
        }
      }
    };

    const entries: Record<string, any>[] = [];
    const reps = recurring && form.mode === 'add' ? Math.max(1, recurringCount) : 1;

    for (let i = 0; i < reps; i++) {
      const data = { ...base };
      ensureFechaPresupuestado(data);
      if (i > 0) {
        if (ft === 'budget') {
          data.mesPresupuestado = addMonth(data.mesPresupuestado, i);
          data.fechaPresupuestado = addMonthToYM(data.fechaPresupuestado || `${new Date().getFullYear()}-01`, i);
          data.fechaEjecutado = addMonthToDate(data.fechaEjecutado, i);
        } else if (ft === 'ejecucion') {
          data.fechaEjecutado = addMonthToDate(data.fechaEjecutado, i);
        }
      }
      if (ft === 'budget' || ft === 'ejecucion') {
        if (!data.projectId) data.projectId = '';
        if (!data.projectName) data.projectName = '';
        if (!data.entityId) data.entityId = '';
        if (!data.entityName) data.entityName = '';
        if (!data.entityType) data.entityType = '';
      }
      if (ft === 'budget') { data.montoPresupuestado = Number(data.montoPresupuestado) || 0; delete data.fechaEjecutado; }
      if (ft === 'ejecucion') {
        data.montoEjecutado = Number(data.montoEjecutado) || 0;
        if (selectedBudgetLinks.length > 0) {
          data._budgetLinks = selectedBudgetLinks.map(l => ({ budgetId: l.budgetId, monto: Number(l.monto) || 0 }));
        }
        if (form.mode === 'add' && pendingComprobantes.length > 0) {
          data._pendingComprobantes = pendingComprobantes.map(pc => ({ id: pc.id, file: pc.file, name: pc.name, type: pc.type, size: pc.size }));
        }
      }
      if (ft === 'project') {
        data.cantidad = Number(data.cantidad) || 0;
        if (data.tipoProyectos === '__custom__') data.tipoProyectos = '';
        if (data.unidades === '__custom__') data.unidades = '';
        data.soloEgresos = data.soloEgresos === 'true';
      }
      if (ft === 'cuenta') {
        data.saldoInicial = Number(data.saldoInicial) || 0;
        if (form.mode === 'add') data.saldoActual = data.saldoInicial;
      }
      if (ft === 'extracto') {
        data.anio = Number(data.anio) || new Date().getFullYear();
        data.saldoInicial = Number(data.saldoInicial) || 0;
        data.saldoFinal = Number(data.saldoFinal) || 0;
        if (data._archivoUploaded) {
          try { data.archivo = JSON.parse(data._archivoUploaded); } catch { /* ignore */ }
          delete data._archivoUploaded;
        }
      }
      entries.push(data);
    }

    for (const entry of entries) {
      await onSubmit(form, entry);
    }
    setSaving(false);
    onBack();
  };

  const title = `${form.mode === 'add' ? 'Nuevo' : 'Editar'} ${ft === 'budget' ? 'Presupuesto' : ft === 'ejecucion' ? 'Ejecución' : ft === 'project' ? 'Proyecto' : ft === 'tercero' ? 'Tercero' : ft === 'client' ? 'Cliente' : ft === 'cuenta' ? 'Cuenta Bancaria' : ft === 'extracto' ? 'Extracto Bancario' : 'Proveedor'}`;

  // ── Project form ──
  if (ft === 'project') {
    return (
      <ProjectForm
        form={form as any}
        companyId={companyId}
        title={title}
        settingsData={settingsData}
        terceros={terceros}
        onSubmit={onSubmit}
        onBack={onBack}
        onClose={onClose}
        saving={saving}
      />
    );
  }

  // ── Cuenta form ──
  if (ft === 'cuenta') {
    return (
      <CuentaForm
        form={form as any}
        title={title}
        onSubmit={onSubmit}
        onBack={onBack}
        onClose={onClose}
        saving={saving}
      />
    );
  }

  // ── Extracto form ──
  if (ft === 'extracto') {
    if (form.mode === 'add') {
      return (
        <ExtractoAddForm
          form={form as any}
          companyId={companyId}
          title={title}
          onSubmit={onSubmit}
          onBack={onBack}
          onClose={onClose}
        />
      );
    }
    return (
      <FormExtractoEdit
        form={form as any}
        companyId={companyId}
        title={title}
        onSubmit={onSubmit}
        onBack={onBack}
        onClose={onClose}
        saving={saving}
        onFieldChange={set}
        getField={f}
      />
    );
  }

  // ── Client / Provider / Tercero form ──
  if (ft === 'client' || ft === 'provider' || ft === 'tercero') {
    return (
      <TerceroForm
        form={form as any}
        title={title}
        onSubmit={onSubmit}
        onBack={onBack}
        onClose={onClose}
        saving={saving}
      />
    );
  }

  // ── Edit User Role Form ──
  if (ft === 'edit-user-role') {
    return <EditUserRoleForm onBack={onBack} onClose={onClose} form={form} />;
  }

  // ── Create Company Form ──
  if (ft === 'create-company') {
    return <CreateCompanyForm onBack={onBack} onClose={onClose} />;
  }

  // ── Invite User Form ──
  if (ft === 'invite-user') {
    return (
      <InviteUserForm
        currentUser={currentUser}
        companies={companies}
        selectedCompany={selectedCompany}
        saving={saving}
        setSaving={setSaving}
        onBack={onBack}
        onClose={onClose}
        form={form}
      />
    );
  }

  // ── Budget or Ejecucion form (default) ──
  if (ft === 'budget') {
    return (
      <BudgetForm
        form={form as any}
        companyId={companyId}
        title={title}
        projects={safeProjects}
        clients={clients}
        providers={providers}
        clientsAndProviders={clientsAndProviders}
        settingsData={settingsData}
        onSubmit={onSubmit}
        onBack={onBack}
        onClose={onClose}
        saving={saving}
      />
    );
  }

  if (ft === 'ejecucion') {
    return (
      <EjecucionForm
        form={form as any}
        companyId={companyId}
        title={title}
        projects={safeProjects}
        clients={clients}
        providers={providers}
        clientsAndProviders={clientsAndProviders}
        allBudgets={allBudgets}
        cuentas={cuentas}
        settingsData={settingsData}
        onSubmit={onSubmit}
        onBack={onBack}
        onClose={onClose}
        saving={saving}
      />
    );
  }

  // Fallback — default form (budget/ejecucion inline, legacy path)
  const filteredBudgets = allBudgets.filter(b => {
    const proj = f('projectName') || f('proyectoAsignado');
    const cli = f('entityName') || f('clienteOProveedor');
    if (proj && cli) return b.projectName === proj || b.entityName === cli;
    if (proj) return b.projectName === proj;
    if (cli) return b.entityName === cli;
    return true;
  });

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <TipoSwitch value={f('tipo')} onChange={v => set('tipo', v)} />
        <SearchableSelect label="Proyecto" value={f('projectId') || f('projectName')} onChange={v => {
          const p = safeProjects.find(p => p.id === v);
          if (p) { set('projectId', p.id); set('projectName', p.name); }
        }} options={safeProjects.map(p => ({ value: p.id, label: p.name }))} placeholder="Buscar proyecto..." />
        {!showNewProject && (
          <button onClick={() => setShowNewProject(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo proyecto
          </button>
        )}
        {showNewProject && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Nombre del proyecto" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <input type="text" value={newProjectClient} onChange={e => setNewProjectClient(e.target.value)} placeholder="Cliente (opcional)" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateProject} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewProject(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <SearchableSelect label="Cliente / Proveedor" value={f('entityId') || f('entityName')} onChange={v => {
          if (!v) { set('entityId', ''); set('entityName', 'Interno'); set('entityType', 'interno'); return; }
          const allEntities = [...clients.map(c => ({ id: c.id, name: c.name, type: 'client' as const })), ...providers.map(p => ({ id: p.id, name: p.name, type: 'provider' as const }))];
          const entity = allEntities.find(e => e.id === v);
          if (entity) { set('entityId', entity.id); set('entityName', entity.name); set('entityType', entity.type); }
        }} options={clientsAndProviders} placeholder="Buscar cliente o proveedor..." />
        {!showNewClient && (
          <button onClick={() => setShowNewClient(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 -mt-3">
            <Plus size={12} /> Nuevo cliente
          </button>
        )}
        {showNewClient && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
            <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre del cliente" className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleCreateClient} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 text-[11px] font-bold">Crear</button>
              <button onClick={() => setShowNewClient(false)} className="px-3 text-slate-500 hover:text-slate-700 text-[11px] font-bold">Cancelar</button>
            </div>
          </div>
        )}
        <FormInput label="Descripción" value={f('descripcion')} onChange={v => set('descripcion', v)} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{ft === 'budget' ? 'Monto Presupuestado' : 'Monto Ejecutado'}</label>
            <button type="button" onClick={() => { setShowCalc(!showCalc); if (!showCalc) setCalcExpr(f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado') || ''); }}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">
              🧮 Calc
            </button>
          </div>
          <input type="text" inputMode="numeric"
            value={montoEditing ? unformatThousands(f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado')) : formatThousands(f(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado'))}
            onFocus={() => setMontoEditing(true)}
            onBlur={() => setMontoEditing(false)}
            onChange={e => set(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado', unformatThousands(e.target.value))}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-right" />
          {showCalc && (
            <Calculator value={calcExpr} onChange={setCalcExpr} onResult={(res) => {
              set(ft === 'budget' ? 'montoPresupuestado' : 'montoEjecutado', String(res));
              setShowCalc(false);
            }} />
          )}
        </div>
        {ft === 'budget' && (
          <div>
            <FormInput label="Fecha del presupuesto" value={f('fechaEjecutado')} onChange={handleDateChange} type="date" />
            {f('mesPresupuestado') && <p className="text-[11px] text-indigo-600 font-medium mt-1">Mes calculado: {f('mesPresupuestado')}</p>}
          </div>
        )}
        {ft === 'ejecucion' && (
          <>
            <FormInput label="Fecha de ejecución" value={f('fechaEjecutado')} onChange={v => set('fechaEjecutado', v)} type="date" />
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                Vincular presupuestos (opcional)
              </p>
              <SearchableSelect label="" value="" onChange={v => {
                if (!v) return;
                const b = allBudgets.find(b => b.id === v);
                if (b && !selectedBudgetLinks.some(l => l.budgetId === b.id)) {
                  setSelectedBudgetLinks(prev => [...prev, { budgetId: b.id, budgetName: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}`, monto: '' }]);
                }
              }} options={allBudgets
                .filter(b => !selectedBudgetLinks.some(l => l.budgetId === b.id))
                .map(b => ({ value: b.id, label: `${b.descripcion} (${formatCurrency(b.montoPresupuestado)}) - ${b.projectName}` }))} placeholder="Buscar presupuesto para vincular..." />
              {selectedBudgetLinks.map((link, idx) => (
                <div key={link.budgetId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 mt-2 border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{link.budgetName}</p>
                    <input type="text" inputMode="numeric" value={link.monto}
                      onChange={e => { const updated = [...selectedBudgetLinks]; updated[idx] = { ...updated[idx], monto: unformatThousands(e.target.value) }; setSelectedBudgetLinks(updated); }}
                      placeholder="Monto a vincular..."
                      className="w-full mt-1 border border-slate-200 rounded px-2 py-1 text-xs focus:border-indigo-500 outline-none bg-white" />
                  </div>
                  <button onClick={() => setSelectedBudgetLinks(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500 transition-colors shrink-0" title="Quitar">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {selectedBudgetLinks.length > 0 && (() => {
                const totalLinks = selectedBudgetLinks.reduce((s, l) => s + (Number(l.monto) || 0), 0);
                const montoEj = Number(f('montoEjecutado')) || 0;
                const diff = Math.abs(montoEj - totalLinks);
                const isValid = diff <= 1;
                return (
                  <p className={clsx("text-[10px] font-bold mt-1.5", isValid ? 'text-emerald-600' : 'text-amber-600')}>
                    Total vinculado: {formatCurrency(totalLinks)}
                    {montoEj > 0 && !isValid && <span className="ml-1">— Diferencia: {formatCurrency(diff)}</span>}
                    {isValid && montoEj > 0 && <span className="ml-1">✓</span>}
                  </p>
                );
              })()}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Comprobantes</p>
              <ComprobanteUploader
                companyId={companyId}
                ejecucionId={form.mode === 'edit' ? (form as any).record?.id : undefined}
                comprobantes={comprobantes}
                onComprobantesChange={setComprobantes}
                mode={form.mode === 'add' ? 'add' : 'edit'}
                pendingComprobantes={pendingComprobantes}
                onPendingChange={setPendingComprobantes}
                tiposComprobante={settingsData?.tipoComprobante || []}
                requiredTypes={REQUIRED_COMPROBANTE_TYPES.map(r => r.name)}
              />
            </div>
            <SearchableSelect label="Cuenta bancaria (opcional)" value={f('cuentaId')} onChange={v => {
              set('cuentaId', v);
              const c = cuentas.find(c => c.id === v);
              if (c) set('cuentaName', `${c.banco} - ${c.nombre} (${c.tipo})`);
            }} options={cuentas.map(c => ({ value: c.id, label: `${c.banco} - ${c.nombre} (${c.tipo})` }))} placeholder="Buscar cuenta bancaria..." />
          </>
        )}
        {form.mode === 'add' && (ft === 'budget' || ft === 'ejecucion') && (
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 mb-3">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              <span className="text-xs font-medium text-slate-600 select-none">Gasto recurrente</span>
            </label>
            {recurring && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 shrink-0">Repetir por</span>
                <input type="number" min={1} max={60} value={recurringCount} onChange={e => setRecurringCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border border-slate-200 rounded-lg p-1.5 text-sm text-center focus:border-indigo-500 outline-none bg-white" />
                <span className="text-[11px] font-medium text-slate-500 shrink-0">meses</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors">
          {saving ? 'Guardando...' : form.mode === 'add' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
