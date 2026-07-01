'use client'

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ViewType, Company } from '@/lib/types';
import { LayoutDashboard, FolderKanban, Users, Building2, Database, FileText, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  const { selectedCompany, companies, setCompany } = useCompany();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setCompany(id);
    setDropdownOpen(false);
    const currentPath = window.location.pathname.replace(/^\/[^/]+/, `/${id}`);
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
  ];

  return (
    <aside className={clsx("bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative shrink-0", collapsed ? "w-16 items-center py-6" : "w-64")}>
      <div className={clsx("flex items-center", collapsed ? "mb-8 justify-center" : "h-14 px-6 border-b border-slate-200 mb-4")}>
        {!collapsed ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3" ref={dropdownRef}>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0 text-sm"
                >
                  {selectedCompany.name[0]}
                </button>
                {dropdownOpen && (
                  <div className="absolute left-0 top-10 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    {companies.map((c: Company) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(c.id)}
                        className={clsx(
                          "w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors",
                          c.id === selectedCompany.id ? "text-indigo-600 font-medium" : "text-slate-700"
                        )}
                      >
                        {c.id === selectedCompany.id && <span className="mr-2">✓</span>}
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="font-bold text-sm text-slate-800 whitespace-nowrap overflow-hidden">{selectedCompany.name}</span>
              <ChevronDown
                size={14}
                className={clsx("text-slate-400 cursor-pointer transition-transform", dropdownOpen && "rotate-180")}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              />
            </div>
          </div>
        ) : (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
            >
              {selectedCompany.name[0]}
            </button>
            {dropdownOpen && (
              <div className="absolute left-full ml-2 top-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                {companies.map((c: Company) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors whitespace-nowrap",
                      c.id === selectedCompany.id ? "text-indigo-600 font-medium" : "text-slate-700"
                    )}
                  >
                    {c.id === selectedCompany.id && <span className="mr-2">✓</span>}
                    {c.name}
                  </button>
                ))}
              </div>
            )}
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
