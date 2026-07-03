'use client'

import { useRouter } from 'next/navigation';
import { ViewType } from '@/lib/types';
import { LayoutDashboard, FolderKanban, Users, Building2, Database, FileText, ChevronLeft, ChevronRight, Layers, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { useCompany } from '@/context/CompanyContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  basePath: string;
}

export function Sidebar({ collapsed, onToggle, activeView, onViewChange, basePath }: SidebarProps) {
  const router = useRouter();
  const { selectedCompany, companies, mode, setCompany, setMode } = useCompany();

  const handleCompanySelect = (id: string) => {
    setCompany(id);
    const currentPath = window.location.pathname.replace(/^\/[^/]+/, `/${id}`);
    router.push(currentPath);
  };

  const handleConjuntoSelect = () => {
    setMode('conjunto');
    const currentPath = window.location.pathname.replace(/^\/[^/]+/, '/all');
    router.push(currentPath);
  };

  const handleNav = (view: ViewType) => {
    onViewChange(view);
  };

  const menuItems: { id: ViewType; label: string; icon: any; path: string }[] = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, path: `${basePath}/dashboard` },
    { id: 'Proyectos', label: 'Proyectos', icon: FolderKanban, path: `${basePath}/proyectos` },
    { id: 'Proveedores', label: 'Proveedores', icon: Building2, path: `${basePath}/proveedores` },
    { id: 'Clientes', label: 'Clientes', icon: Users, path: `${basePath}/clientes` },
    { id: 'Extractos', label: 'Extractos', icon: FileText, path: `${basePath}/extractos` },
    { id: 'Datos', label: 'Datos', icon: Database, path: `${basePath}/datos` },
    { id: 'EstadoResultados', label: 'Estado de Resultados', icon: TrendingUp, path: `${basePath}/estado-resultados` },
  ];

  return (
    <aside className={clsx("bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative shrink-0", collapsed ? "w-16 items-center py-6" : "w-64")}>
      {/* Company Selector */}
      <div className={clsx("flex items-center", collapsed ? "mb-8 justify-center flex-col gap-2" : "px-4 py-3 border-b border-slate-200 mb-4")}>
        {!collapsed ? (
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</span>
            </div>
            
            {/* Segmented Control for 3 modes */}
            <div className="bg-slate-100 rounded-lg p-1 space-y-1">
              {/* Individual companies */}
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleCompanySelect(c.id)}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center gap-2",
                    mode === 'individual' && selectedCompany?.id === c.id
                      ? "bg-white text-indigo-600 font-semibold shadow-sm"
                      : "text-slate-600 hover:bg-white/50"
                  )}
                >
                  <div className={clsx(
                    "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
                    mode === 'individual' && selectedCompany?.id === c.id
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-slate-200 text-slate-500"
                  )}>
                    {c.name[0]}
                  </div>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
              
              {/* Divider */}
              {companies.length > 0 && (
                <div className="border-t border-slate-200 my-1" />
              )}
              
              {/* Conjunto option */}
              <button
                onClick={handleConjuntoSelect}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-all flex items-center gap-2",
                  mode === 'conjunto'
                    ? "bg-white text-indigo-600 font-semibold shadow-sm"
                    : "text-slate-600 hover:bg-white/50"
                )}
              >
                <div className={clsx(
                  "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                  mode === 'conjunto'
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-slate-200 text-slate-500"
                )}>
                  <Layers size={14} />
                </div>
                <span className="truncate">Todas las empresas</span>
              </button>
            </div>
          </div>
        ) : (
          // Collapsed state - show icon buttons
          <div className="flex flex-col gap-2">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCompanySelect(c.id)}
                className={clsx(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-all",
                  mode === 'individual' && selectedCompany?.id === c.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                )}
                title={c.name}
              >
                {c.name[0]}
              </button>
            ))}
            <button
              onClick={handleConjuntoSelect}
              className={clsx(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                mode === 'conjunto'
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-200 text-slate-500 hover:bg-slate-300"
              )}
              title="Todas las empresas"
            >
              <Layers size={18} />
            </button>
          </div>
        )}
      </div>
      
      <button 
        onClick={onToggle}
        className="absolute -right-3 top-16 bg-white rounded-full p-1 border border-slate-200 shadow-sm hover:bg-slate-50 z-10 text-slate-400 hover:text-slate-600"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className={clsx("flex-1 flex flex-col gap-2 overflow-y-auto", collapsed ? "px-0 w-full items-center gap-6" : "px-4 py-2")}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={clsx(
                "flex items-center transition-colors overflow-hidden whitespace-nowrap cursor-pointer",
                isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-indigo-600",
                collapsed ? "justify-center p-2 rounded-lg" : "px-3 py-2.5 rounded-xl gap-3 w-full"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={clsx("mt-auto mb-4", collapsed ? "w-full flex justify-center" : "px-4")}>
        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
      </div>
    </aside>
  );
}
