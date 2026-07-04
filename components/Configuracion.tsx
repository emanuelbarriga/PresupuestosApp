'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  subscribeUserCompanies,
  subscribeCompanyMembers,
  subscribeCompanyInvitations,
  createInvitation,
} from '@/lib/firestore';
import { Company, CompanyMember, Invitacion } from '@/lib/types';
import {
  Shield, Mail, Copy, Check, UserPlus, Clock, Building2, ChevronDown, Trash2, Plus,
} from 'lucide-react';

type ExpiryPreset = 1 | 3 | 7;

interface CompanySection {
  company: Company;
  members: CompanyMember[];
  invitations: Invitacion[];
  isAdmin: boolean;
}

export function Configuracion() {
  const { user } = useAuth();
  const { userRole } = useCompany();

  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [sections, setSections] = useState<CompanySection[]>([]);
  const [originUrl, setOriginUrl] = useState('');

  // ── Invite form state ──
  const [inviteCompany, setInviteCompany] = useState<Company | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'colaborador' | 'admin'>('colaborador');
  const [inviteExpiry, setInviteExpiry] = useState<ExpiryPreset>(7);
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Delete state ──
  const [deleting, setDeleting] = useState<{ companyId: string; uid: string } | null>(null);

  useEffect(() => { setOriginUrl(window.location.origin); }, []);

  // Subscribe to all companies the user belongs to
  useEffect(() => {
    if (!user) return;
    return subscribeUserCompanies(user.uid, setUserCompanies, console.error);
  }, [user]);

  // For each company, subscribe to members + invitations
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    for (const c of userCompanies) {
      let mem: CompanyMember[] = [];
      let inv: Invitacion[] = [];

      const u1 = subscribeCompanyMembers(c.id, (data) => {
        mem = data;
        updateSection();
      }, console.error);

      const u2 = subscribeCompanyInvitations(c.id, (data) => {
        inv = data;
        updateSection();
      }, console.error);

      function updateSection() {
        setSections((prev) => {
          const next = prev.filter((s) => s.company.id !== c.id);
          const isAdmin = !!mem.find((m) => m.id === user?.uid && m.role === 'admin');
          return [...next, { company: c, members: mem, invitations: inv, isAdmin }];
        });
      }

      unsubs.push(u1, u2);
    }

    // Cleanup companies no longer in the list
    setSections((prev) => prev.filter((s) => userCompanies.some((c) => c.id === s.company.id)));

    return () => unsubs.forEach((fn) => fn());
  }, [userCompanies, user]);

  // Pre-select invite company
  useEffect(() => {
    if (userCompanies.length > 0 && !inviteCompany) {
      setInviteCompany(userCompanies[0]);
    }
  }, [userCompanies]);

  // ── Delete member ──
  const handleDeleteMember = async (companyId: string, memberId: string, memberEmail: string) => {
    if (!confirm(`¿Eliminar a ${memberEmail} de la empresa?`)) return;
    setDeleting({ companyId, uid: memberId });
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'members', memberId));
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('Error al eliminar el miembro');
    } finally {
      setDeleting(null);
    }
  };

  // ── Create invitation ──
  const handleCreateInvite = async () => {
    if (!inviteEmail.trim() || !inviteCompany || !user) return;
    setCreating(true);
    try {
      const expiresDate = new Date(Date.now() + inviteExpiry * 24 * 60 * 60 * 1000);
      const invitationId = await createInvitation({
        companyId: inviteCompany.id,
        companyName: inviteCompany.name,
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'pendiente',
        invitedBy: user.uid,
        createdAt: new Date().toISOString(),
        expiresAt: expiresDate.toISOString(),
      });
      setGeneratedLink(`${originUrl}/register?invite=${invitationId}`);
      setInviteEmail('');
    } finally {
      setCreating(false);
    }
  };

  // ── Formatters ──
  const fmtDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const expiryLabel: Record<ExpiryPreset, string> = { 1: '1 día', 3: '3 días', 7: '1 semana' };

  // Filter to companies where user is admin (for member management)
  const adminSections = sections.filter((s) => s.isAdmin);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-xl font-bold text-slate-800">Configuración</h1>

      {/* Only the section for admin's companies — they can ONLY manage companies
          where `isAdmin == true`. However the array `sections` also contains
          companies where the user is *only* a colaborador, which we skip here. */}

      {adminSections.length === 0 && (
        <div className="text-center py-12 text-sm text-slate-400">
          {userCompanies.length === 0
            ? 'Todavía no formás parte de ninguna empresa.'
            : 'No tenés permisos de administrador en ninguna empresa.'}
        </div>
      )}

      {adminSections.map(({ company, members, invitations, isAdmin }) =>
        !isAdmin ? null : (
          <section
            key={company.id}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
          >
            {/* Company header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-700">{company.name}</h2>
            </div>

            {/* Members */}
            <div className="p-4 border-b border-slate-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Shield size={13} /> Miembros ({members.length})
                </h3>
              </div>
              <div className="space-y-2">
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin miembros</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-600 uppercase">
                        {m.email[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{m.email}</p>
                        <p className="text-[11px] text-slate-400">Se unió el {fmtDate(m.joinedAt)}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {m.role === 'admin' ? 'Admin' : 'Colaborador'}
                      </span>
                      {m.id !== user?.uid && (
                        <button
                          onClick={() => handleDeleteMember(company.id, m.id, m.email)}
                          disabled={deleting?.companyId === company.id && deleting?.uid === m.id}
                          className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                          title={`Eliminar de ${company.name}`}
                        >
                          {deleting?.companyId === company.id && deleting?.uid === m.id ? (
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
            </div>

            {/* Invitations */}
            <div className="p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-3">
                <Mail size={13} /> Invitaciones pendientes ({invitations.length})
              </h3>
              <div className="space-y-2">
                {invitations.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin invitaciones pendientes</p>
                ) : (
                  invitations.map((inv) => {
                    const link = `${originUrl}/register?invite=${inv.id}`;
                    const isExpired = inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now();
                    return (
                      <div key={inv.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-700 truncate">{inv.email}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                              {inv.role === 'admin' ? 'Admin' : 'Colaborador'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-[11px] text-slate-400">Enviada: {fmtDate(inv.createdAt)}</p>
                            {inv.expiresAt && !isExpired && (
                              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                                <Clock size={11} />
                                {Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))}d restantes
                              </span>
                            )}
                            {isExpired && <span className="text-[11px] text-red-500">Expirada</span>}
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(link); }}
                            className="mt-1 flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            <Copy size={11} /> Copiar link
                          </button>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${inv.status === 'pendiente' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {inv.status === 'pendiente' ? 'Pendiente' : 'Aceptada'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )
      )}

      {/* ── Create Invitation (global, includes company selector) ── */}
      {adminSections.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">Crear Invitación</h2>
          </div>

          {generatedLink ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-bold text-emerald-800 mb-2">¡Invitación creada!</p>
                <p className="text-xs text-emerald-700 mb-1">Caduca en {expiryLabel[inviteExpiry]}</p>
                <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <code className="text-xs text-slate-600 break-all flex-1">{generatedLink}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
              </div>
              <button onClick={() => setGeneratedLink(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">
                Crear otra invitación
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Company */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Empresa *</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={inviteCompany?.id ?? ''}
                    onChange={(e) => setInviteCompany(userCompanies.find((c) => c.id === e.target.value) ?? null)}
                    className="w-full appearance-none border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
                  >
                    {userCompanies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo electrónico *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colaborador@ejemplo.com"
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Rol</label>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setInviteRole('colaborador')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${inviteRole === 'colaborador' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >Colaborador</button>
                  <button
                    type="button"
                    onClick={() => setInviteRole('admin')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${inviteRole === 'admin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >Administrador</button>
                </div>
              </div>

              {/* Expiry presets */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Caduca en</label>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  {([1, 3, 7] as ExpiryPreset[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setInviteExpiry(d)}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${inviteExpiry === d ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                    >{expiryLabel[d]}</button>
                  ))}
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
