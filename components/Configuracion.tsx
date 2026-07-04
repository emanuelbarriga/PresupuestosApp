'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeCompanyMembers, subscribeCompanyInvitations, subscribeUserCompanies, createInvitation } from '@/lib/firestore';
import { CompanyMember, Invitacion, Company } from '@/lib/types';
import { Shield, Mail, Copy, Check, UserPlus, Clock, Building2, ChevronDown, Trash2, Calendar } from 'lucide-react';

export function Configuracion() {
  const { user } = useAuth();
  const { selectedCompany, userRole } = useCompany();
  const companyId = selectedCompany?.id ?? '';

  // Members state
  const [members, setMembers] = useState<CompanyMember[]>([]);
  // Invitations state
  const [invitations, setInvitations] = useState<Invitacion[]>([]);
  // User's companies (for company selector in invite form)
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  // Create form state
  const [inviteCompany, setInviteCompany] = useState<Company | null>(selectedCompany);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'colaborador' | 'admin'>('colaborador');
  const [inviteExpiryDate, setInviteExpiryDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Base URL (computed on client only to keep SSR/hydration consistent)
  const [originUrl, setOriginUrl] = useState('');

  useEffect(() => {
    setOriginUrl(window.location.origin);
  }, []);

  // Subscribe to members + invitations
  useEffect(() => {
    if (!companyId) return;
    const unsubMembers = subscribeCompanyMembers(companyId, setMembers, console.error);
    const unsubInv = subscribeCompanyInvitations(companyId, setInvitations, console.error);
    return () => { unsubMembers(); unsubInv(); };
  }, [companyId]);

  // Subscribe to user's companies (for invite company selector)
  useEffect(() => {
    if (!user) return;
    return subscribeUserCompanies(user.uid, (companies) => {
      setUserCompanies(companies);
      // Pre-select the first company as fallback if current isn't in list
      if (!companies.find(c => c.id === selectedCompany?.id)) {
        setInviteCompany(companies[0] ?? null);
      }
    }, console.error);
  }, [user]);

  // Create invitation + generate link
  const handleCreateInvite = async () => {
    if (!inviteEmail.trim() || !inviteCompany || !user) return;
    setCreating(true);
    try {
      const invitationId = await createInvitation({
        companyId: inviteCompany.id,
        companyName: inviteCompany.name,
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'pendiente',
        invitedBy: user.uid,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(inviteExpiryDate + 'T23:59:59').toISOString(),
      });
      const link = `${originUrl}/register?invite=${invitationId}`;
      setGeneratedLink(link);
      setInviteEmail('');
      // Reset expiry back to 7 days for next invite
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setInviteExpiryDate(d.toISOString().split('T')[0]);
      // The invitations list updates automatically via subscription
    } finally {
      setCreating(false);
    }
  };

  // Delete member
  const [deletingMember, setDeletingMember] = useState<string | null>(null);

  const handleDeleteMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`¿Eliminar a ${memberEmail} de ${selectedCompany?.name}?`)) return;
    setDeletingMember(memberId);
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'members', memberId));
    } catch (err) {
      console.error('Error al eliminar miembro:', err);
      alert('Error al eliminar el miembro. Si el problema persiste, la regla de seguridad podría necesitar actualización.');
    } finally {
      setDeletingMember(null);
    }
  };

  // Copy link
  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format helpers
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expirada';
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 24) return `${hours}h restantes`;
    const days = Math.floor(hours / 24);
    return `${days} días restantes`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-xl font-bold text-slate-800">Configuración</h1>

      {/* Miembros del Equipo */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">Miembros del Equipo</h2>
            <span className="text-[11px] text-slate-400 font-medium">({members.length})</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {members.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 italic">No hay miembros todavía</div>
          ) : (
            members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-600 uppercase">
                  {m.email[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{m.email}</p>
                  <p className="text-[11px] text-slate-400">Se unió el {formatDate(m.joinedAt)}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                  {m.role === 'admin' ? 'Admin' : 'Colaborador'}
                </span>
                {/* Delete member — admin only, cannot delete self */}
                {userRole === 'admin' && m.id !== user?.uid && (
                  <button
                    onClick={() => handleDeleteMember(m.id, m.email)}
                    disabled={deletingMember === m.id}
                    className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    title={`Eliminar a ${m.email}`}
                  >
                    {deletingMember === m.id ? (
                      <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Invitaciones Pendientes */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">Invitaciones Pendientes</h2>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {invitations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 italic">No hay invitaciones pendientes</div>
          ) : (
            invitations.map(inv => {
              const link = `${originUrl}/register?invite=${inv.id}`;
              const isExpired = inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now();
              return (
                <div key={inv.id} className="px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-700 truncate">{inv.email}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {inv.role === 'admin' ? 'Admin' : 'Colaborador'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[11px] text-slate-400">Enviada: {formatDate(inv.createdAt)}</p>
                        {inv.expiresAt && !isExpired && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600">
                            <Clock size={11} /> {formatTimeLeft(inv.expiresAt)}
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[11px] text-red-500 font-medium">Expirada</span>
                        )}
                      </div>
                      {/* Copy link button */}
                      <button
                        onClick={() => { navigator.clipboard.writeText(link); }}
                        className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        <Copy size={12} /> Copiar link de invitación
                      </button>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${inv.status === 'pendiente' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {inv.status === 'pendiente' ? 'Pendiente' : 'Aceptada'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Crear invitación — admin only */}
      {userRole === 'admin' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">Crear Invitación</h2>
          </div>

          {generatedLink ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-bold text-emerald-800 mb-2">¡Invitación creada!</p>
                <p className="text-xs text-emerald-700 mb-1">Copiá este link y envíaselo al invitado:</p>
                <p className="text-[11px] text-emerald-600 mb-3">Caduca el {formatDate(inviteExpiryDate + 'T23:59:59')}</p>
                <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <code className="text-xs text-slate-600 break-all flex-1">{generatedLink}</code>
                  <button
                    onClick={() => handleCopy(generatedLink)}
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setGeneratedLink(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Crear otra invitación
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Company selector — only show if user has access to multiple companies */}
              {userCompanies.length > 1 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Empresa *
                  </label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={inviteCompany?.id ?? ''}
                      onChange={e => {
                        const c = userCompanies.find(c => c.id === e.target.value);
                        setInviteCompany(c ?? null);
                      }}
                      className="w-full appearance-none border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
                    >
                      {userCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Correo electrónico del invitado *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colaborador@ejemplo.com"
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Rol</label>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setInviteRole('colaborador')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${inviteRole === 'colaborador' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    Colaborador
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole('admin')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${inviteRole === 'admin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    Administrador
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Caduca el *
                </label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={inviteExpiryDate}
                    onChange={e => setInviteExpiryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full appearance-none border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleCreateInvite}
                disabled={creating || !inviteEmail.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                {creating ? 'Creando...' : 'Crear invitación'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}