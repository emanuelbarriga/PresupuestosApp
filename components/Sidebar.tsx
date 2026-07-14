'use client'

import { useRouter, useParams } from 'next/navigation';
import { ViewType } from '@/lib/types';
import {
  LayoutDashboard, FolderKanban, Users, Building2, Database,
  FileText, TrendingUp, Settings, LogOut, Camera,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanyStore } from '@/stores/companyStore';
import { Tooltip } from './Tooltip';

interface SidebarProps {
  activeView: ViewType;
  basePath: string;
}

const NAV_ITEMS: { id: ViewType; label: string; icon: any }[] = [
  { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'EstadoResultados', label: 'Estado de Resultados', icon: TrendingUp },
  { id: 'Proyectos', label: 'Proyectos', icon: FolderKanban },
  { id: 'Proveedores', label: 'Proveedores', icon: Building2 },
  { id: 'Clientes', label: 'Clientes', icon: Users },
  { id: 'Extractos', label: 'Extractos', icon: FileText },
  { id: 'Media', label: 'Media', icon: Camera },
  { id: 'Datos', label: 'Datos', icon: Database },
];

export function Sidebar({ activeView, basePath }: SidebarProps) {
  const router = useRouter();
  const params = useParams();
  const companies = useCompanyStore(s => s.companies);
  const selectedCompany = useCompanyStore(s => s.selectedCompany);
  const userRole = useCompanyStore(s => s.userRole);
  const { user, signOut } = useAuth();

  const switchCompany = (id: string) => {
    const segments = (params.segments as string[] | undefined) || [];
    const restPath = segments.length > 0 ? `/${segments.join('/')}` : '/dashboard';
    router.push(`/${id}${restPath}`);
  };

  const navItems = userRole === 'admin'
    ? [...NAV_ITEMS, { id: 'Configuración' as ViewType, label: 'Configuración', icon: Settings }]
    : NAV_ITEMS;

  const pathFor = (item: { id: ViewType }) => {
    const segment = item.id === 'Dashboard' ? 'dashboard'
      : item.id === 'EstadoResultados' ? 'estado-resultados'
      : item.id === 'Configuración' ? 'configuracion'
      : item.id === 'Media' ? 'media'
      : item.id.toLowerCase();
    return `${basePath}/${segment}`;
  };

  return (
    <aside
      aria-label="Navegación principal"
      className="bg-white border-r border-slate-200 flex flex-col items-center pt-5 pb-4 relative shrink-0 w-16"
    >
      {/* Company Selector */}
      <div className="flex flex-col items-center gap-1.5 mb-6">
        {companies.map(c => (
          <Tooltip key={c.id} label={c.name} accent>
            <button onClick={() => switchCompany(c.id)}
              className={[
                'w-9 h-9 rounded-lg font-bold transition-all flex items-center justify-center text-sm',
                selectedCompany?.id === c.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
              ].join(' ')}>
              {c.name[0]}
            </button>
          </Tooltip>
        ))}
        {userRole === 'admin' && (
          <Tooltip label="Crear empresa" accent>
            <button onClick={() => router.push(`${basePath}/dashboard?create-company=1`)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-all">
              +
            </button>
          </Tooltip>
        )}
      </div>

      {/* Section divider */}
      <div className="w-8 h-px bg-slate-200 mb-6" />

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-3 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <Tooltip key={item.id} label={item.label}>
              <button onClick={() => router.push(pathFor(item))}
                className={[
                  'flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer',
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100',
                ].join(' ')}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.75} />
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        {user?.email && (
          <Tooltip label={user.email}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              {user.email[0].toUpperCase()}
            </div>
          </Tooltip>
        )}
        <Tooltip label="Cerrar sesión">
          <button onClick={async () => { await signOut(); router.push('/login'); }}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
            <LogOut size={16} />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
