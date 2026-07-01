'use client'

import { ViewType } from '@/lib/types';
import { LayoutDashboard, FolderKanban, Users, Building2, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function Sidebar({ collapsed, onToggle, activeView, onViewChange }: SidebarProps) {
  const menuItems: { id: ViewType; label: string; icon: any }[] = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Proyectos', label: 'Proyectos', icon: FolderKanban },
    { id: 'Proveedores', label: 'Proveedores', icon: Building2 },
    { id: 'Clientes', label: 'Clientes', icon: Users },
    { id: 'Datos', label: 'Datos', icon: Database },
  ];

  return (
    <aside className={clsx("bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative shrink-0", collapsed ? "w-16 items-center py-6" : "w-64")}>
      <div className={clsx("flex items-center", collapsed ? "mb-8 justify-center" : "h-14 px-6 border-b border-slate-200 justify-between mb-4")}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0 text-sm">B</div>
            <span className="font-bold text-sm text-slate-800 whitespace-nowrap overflow-hidden">Gestor Presupuestos</span>
          </div>
        ) : (
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">B</div>
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
              onClick={() => onViewChange(item.id)}
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
