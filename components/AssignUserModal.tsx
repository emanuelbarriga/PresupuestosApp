'use client'

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

interface AssignUserModalProps {
  user: { id: string; email: string };
  companies: { id: string; name: string }[];
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignUserModal({ user, companies, onClose, onAssigned }: AssignUserModalProps) {
  const { user: currentUser } = useAuth();
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<'colaborador' | 'admin'>('colaborador');
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!companyId || !currentUser) return;
    setAssigning(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/companies/assign-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, companyId, role, email: user.email }),
      });
      if (!res.ok) throw new Error('Error al asignar');
      toast.success(`${user.email} asignado como ${role === 'admin' ? 'Admin' : 'Colaborador'}`);
      onAssigned();
    } catch {
      toast.error('Error al asignar usuario');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Asignar usuario</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Asignar a <strong>{user.email}</strong> a una empresa:
        </p>

        <div className="space-y-4">
          {/* Empresa */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Empresa</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="">Seleccioná una empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol</label>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button type="button" onClick={() => setRole('colaborador')}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                  role === 'colaborador' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}>
                Colaborador
              </button>
              <button type="button" onClick={() => setRole('admin')}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                  role === 'admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                }`}>
                Admin
              </button>
            </div>
          </div>

          <button
            onClick={handleAssign}
            disabled={!companyId || assigning}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            {assigning ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <UserPlus size={14} />
            )}
            {assigning ? 'Asignando...' : 'Asignar a empresa'}
          </button>
        </div>
      </div>
    </div>
  );
}
