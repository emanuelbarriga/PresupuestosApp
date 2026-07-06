'use client'

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeUserCompanies,
  subscribeCompanyMembers,
  subscribeCompanyInvitations,
  deleteMemberFromCompany,
  blockMember,
  deleteInvitation,
  updateMemberRole,
} from '@/lib/firestore';
import { Company, CompanyMember, Invitacion, FormType, ActiveForm } from '@/lib/types';
import {
  Shield, Mail, Copy, Check, UserPlus, Clock, Trash2, Pencil, Ban, X,
} from 'lucide-react';

// ── Aggregated types ──

interface AggregatedUser {
  userId: string;
  email: string;
  memberships: {
    companyId: string;
    companyName: string;
    role: string;
    blocked: boolean;
  }[];
}

interface AggregatedInvitation extends Invitacion {
  companyName: string;
}

interface ConfiguracionProps {
  onAddNew?: (type: FormType, defaults?: Record<string, string>) => void;
  onEditRecord?: (form: ActiveForm) => void;
}

// ── Internal per-company subscription state ──

interface CompanyData {
  company: Company;
  members: CompanyMember[];
  invitations: Invitacion[];
  isAdmin: boolean;
}

export function Configuracion({ onAddNew, onEditRecord }: ConfiguracionProps) {
  const { user } = useAuth();

  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [companyDataMap, setCompanyDataMap] = useState<Record<string, CompanyData>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [originUrl, setOriginUrl] = useState('');

  // ── Action loading states ──
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [blockingMember, setBlockingMember] = useState<string | null>(null);
  const [deletingInvitation, setDeletingInvitation] = useState<string | null>(null);

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

      const updateData = () => {
        const isAdmin = !!mem.find((m) => m.id === user?.uid && m.role === 'admin');
        setCompanyDataMap((prev) => ({
          ...prev,
          [c.id]: { company: c, members: mem, invitations: inv, isAdmin },
        }));
      };

      const u1 = subscribeCompanyMembers(c.id, (data) => {
        mem = data;
        updateData();
      }, console.error);

      const u2 = subscribeCompanyInvitations(c.id, (data) => {
        inv = data;
        updateData();
      }, console.error);

      unsubs.push(u1, u2);
    }

    // Remove companies no longer in the list
    setCompanyDataMap((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (!userCompanies.some((c) => c.id === key)) {
          delete next[key];
        }
      }
      return next;
    });

    return () => unsubs.forEach((fn) => fn());
  }, [userCompanies, user]);

  // ── Aggregate users across all admin companies ──
  const aggregatedUsers = useMemo<AggregatedUser[]>(() => {
    const userMap = new Map<string, AggregatedUser>();

    for (const data of Object.values(companyDataMap)) {
      if (!data.isAdmin) continue;
      for (const member of data.members) {
        const existing = userMap.get(member.id);
        const membership = {
          companyId: data.company.id,
          companyName: data.company.name,
          role: member.role,
          blocked: member.blocked ?? false,
        };
        if (existing) {
          existing.memberships.push(membership);
        } else {
          userMap.set(member.id, {
            userId: member.id,
            email: member.email,
            memberships: [membership],
          });
        }
      }
    }

    return Array.from(userMap.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [companyDataMap]);

  // ── Aggregate invitations across all admin companies ──
  const aggregatedInvitations = useMemo<AggregatedInvitation[]>(() => {
    const result: AggregatedInvitation[] = [];
    for (const data of Object.values(companyDataMap)) {
      if (!data.isAdmin) continue;
      for (const inv of data.invitations) {
        result.push({ ...inv, companyName: data.company.name });
      }
    }
    return result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [companyDataMap]);

  const adminCompanyCount = Object.values(companyDataMap).filter((d) => d.isAdmin).length;

  // ── Formatters ──
  const fmtDate = (val: unknown) => {
    if (!val) return '-';
    try {
      // Firestore Timestamp object ({ seconds, nanoseconds })
      if (typeof val === 'object' && val !== null && 'seconds' in val && 'nanoseconds' in val) {
        return new Date((val as any).seconds * 1000).toLocaleDateString('es-CO', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
      }
      // ISO string
      return new Date(val as string).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const getInvitationStatus = (inv: Invitacion): 'pendiente' | 'aceptada' | 'expired' => {
    if (inv.status === 'aceptada') return 'aceptada';
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) return 'expired';
    return 'pendiente';
  };

  // ── Actions ──

  const handleRemoveFromCompany = async (companyId: string, memberId: string, memberEmail: string, companyName: string) => {
    if (!confirm(`¿Eliminar a ${memberEmail} de ${companyName}?`)) return;
    const key = `${companyId}:${memberId}`;
    setDeletingMember(key);
    try {
      await deleteMemberFromCompany(companyId, memberId);
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Error al eliminar el miembro');
    } finally {
      setDeletingMember(null);
    }
  };

  const handleDeleteUserFromAll = async (aggregatedUser: AggregatedUser) => {
    const companyNames = aggregatedUser.memberships.map((m) => m.companyName).join(', ');
    if (!confirm(`¿Eliminar a ${aggregatedUser.email} de todas las empresas (${companyNames})?`)) return;
    setDeletingMember(aggregatedUser.userId);
    try {
      await Promise.all(
        aggregatedUser.memberships.map((m) => deleteMemberFromCompany(m.companyId, aggregatedUser.userId)),
      );
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Error al eliminar el usuario');
    } finally {
      setDeletingMember(null);
    }
  };

  const handleBlockUser = async (companyId: string, memberId: string, currentBlocked: boolean) => {
    const key = `${companyId}:${memberId}`;
    setBlockingMember(key);
    try {
      await blockMember(companyId, memberId, !currentBlocked);
    } catch (err) {
      console.error('Error blocking/unblocking member:', err);
      alert('Error al actualizar el estado del miembro');
    } finally {
      setBlockingMember(null);
    }
  };

  const handleCopyLink = async (invId: string) => {
    const link = `${originUrl}/register?invite=${invId}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(invId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteInvitation = async (invId: string, email: string) => {
    if (!confirm(`¿Eliminar la invitación para ${email}?`)) return;
    setDeletingInvitation(invId);
    try {
      await deleteInvitation(invId);
    } catch (err) {
      console.error('Error deleting invitation:', err);
      alert('Error al eliminar la invitación');
    } finally {
      setDeletingInvitation(null);
    }
  };

  // ── Status badge ──
  const StatusBadge = ({ status }: { status: 'pendiente' | 'aceptada' | 'expired' }) => {
    const styles = {
      pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
      aceptada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      expired: 'bg-red-50 text-red-700 border-red-200',
    };
    const labels = { pendiente: 'Pendiente', aceptada: 'Aceptada', expired: 'Expirada' };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // ── Company tag pill ──
  const CompanyTag = ({
    companyName,
    role,
    blocked,
    onRemove,
  }: {
    companyName: string;
    role: string;
    blocked: boolean;
    onRemove: () => void;
  }) => (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        blocked
          ? 'bg-red-50 text-red-600 border-red-200'
          : role === 'admin'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-slate-50 text-slate-600 border-slate-200'
      }`}
    >
      {companyName}: {role === 'admin' ? 'Admin' : 'Colab'}
      {blocked && ' (Bloq)'}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-0.5 hover:bg-red-100 rounded-full p-0.5 transition-colors"
        title={`Eliminar de ${companyName}`}
      >
        <X size={10} />
      </button>
    </span>
  );

  const isCurrentUser = (userId: string) => userId === user?.uid;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-xl font-bold text-slate-800">Configuración</h1>

      {adminCompanyCount === 0 && (
        <div className="text-center py-12 text-sm text-slate-400">
          {userCompanies.length === 0
            ? 'Todavía no formás parte de ninguna empresa.'
            : 'No tenés permisos de administrador en ninguna empresa.'}
        </div>
      )}

      {/* ── Users Table ── */}
      {adminCompanyCount > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Shield size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">
              Usuarios ({aggregatedUsers.length})
            </h2>
          </div>

          {aggregatedUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">Sin miembros</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Empresas</th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedUsers.map((au) => (
                    <tr key={au.userId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      {/* Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 text-[10px] font-bold text-indigo-600 uppercase">
                            {au.email[0]}
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                            {au.email}
                          </span>
                          {isCurrentUser(au.userId) && (
                            <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">VOS</span>
                          )}
                        </div>
                      </td>

                      {/* Empresas tags */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {au.memberships.map((m) => (
                            <CompanyTag
                              key={m.companyId}
                              companyName={m.companyName}
                              role={m.role}
                              blocked={m.blocked}
                              onRemove={() => handleRemoveFromCompany(m.companyId, au.userId, au.email, m.companyName)}
                            />
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit button */}
                          <button
                            onClick={() => onEditRecord?.({
                              mode: 'edit',
                              type: 'edit-user-role',
                              record: {
                                userId: au.userId,
                                email: au.email,
                                memberships: au.memberships.map(m => ({
                                  companyId: m.companyId,
                                  companyName: m.companyName,
                                  role: m.role,
                                  blocked: m.blocked,
                                })),
                              },
                            })}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar roles en empresas"
                          >
                            <Pencil size={14} />
                          </button>

                          {/* Block button — per membership */}
                          {au.memberships.map((m) => (
                            <button
                              key={`block-${m.companyId}`}
                              onClick={() => handleBlockUser(m.companyId, au.userId, m.blocked)}
                              disabled={blockingMember === `${m.companyId}:${au.userId}`}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                m.blocked
                                  ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                              }`}
                              title={m.blocked ? `Desbloquear en ${m.companyName}` : `Bloquear en ${m.companyName}`}
                            >
                              {blockingMember === `${m.companyId}:${au.userId}` ? (
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                              ) : (
                                <Ban size={14} />
                              )}
                            </button>
                          ))}

                          {/* Delete button — only if not current user */}
                          {!isCurrentUser(au.userId) && (
                            <button
                              onClick={() => handleDeleteUserFromAll(au)}
                              disabled={deletingMember === au.userId}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Eliminar de todas las empresas"
                            >
                              {deletingMember === au.userId ? (
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-red-400 border-t-transparent rounded-full" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Invitations Table ── */}
      {adminCompanyCount > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-700">
                Invitaciones ({aggregatedInvitations.length})
              </h2>
            </div>
            <button
              onClick={() => onAddNew?.('invite-user')}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
            >
              <UserPlus size={13} />
              Crear Invitación
            </button>
          </div>

          {aggregatedInvitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">Sin invitaciones</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Empresa</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Rol</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Creada</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Caduca</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Estado</th>
                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedInvitations.map((inv) => {
                    const status = getInvitationStatus(inv);
                    return (
                      <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        {/* Email */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[180px] block">
                            {inv.email}
                          </span>
                        </td>

                        {/* Empresa */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">{inv.companyName}</span>
                        </td>

                        {/* Rol */}
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.role === 'admin'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {inv.role === 'admin' ? 'Admin' : 'Colaborador'}
                          </span>
                        </td>

                        {/* Creada */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500">{fmtDate(inv.createdAt)}</span>
                        </td>

                        {/* Caduca */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">{fmtDate(inv.expiresAt ?? '')}</span>
                            {status === 'pendiente' && inv.expiresAt && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                                <Clock size={10} />
                                {Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))}d
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <StatusBadge status={status} />
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit */}
                            <button
                              onClick={() => onEditRecord?.({
                                mode: 'edit',
                                type: 'invite-user',
                                record: inv,
                              })}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>

                            {/* Copy link */}
                            <button
                              onClick={() => handleCopyLink(inv.id!)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                copiedId === inv.id
                                  ? 'text-emerald-600 bg-emerald-50'
                                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="Copiar link"
                            >
                              {copiedId === inv.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteInvitation(inv.id!, inv.email)}
                              disabled={deletingInvitation === inv.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              {deletingInvitation === inv.id ? (
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-red-400 border-t-transparent rounded-full" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
