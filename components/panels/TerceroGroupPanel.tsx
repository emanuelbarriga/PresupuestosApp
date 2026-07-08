'use client';

import React, { useState } from 'react';
import { DetalleTerceroGroup, SidepanelData } from '@/lib/types';
import clsx from 'clsx';
import { EntityTypeBadge } from '@/components/shared/EntityTypeBadge';

const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

interface TerceroGroupPanelProps {
  projects: Array<{
    projectId: string;
    projectName: string;
    groups: DetalleTerceroGroup[];
    totalPresupuestado: number;
    totalEjecutado: number;
    diferencia: number;
  }>;
  onCellClick?: (data: SidepanelData) => void;
  mode: 'Presupuestado' | 'Ejecutado';
}

export function TerceroGroupPanel({ projects, onCellClick, mode }: TerceroGroupPanelProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map(p => p.projectId))
  );

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleTerceroClick = (project: typeof projects[number], group: (typeof projects[number]['groups'][number]) & DetalleTerceroGroup) => {
    const value = mode === 'Presupuestado' ? group.totalPresupuestado : group.totalEjecutado;
    onCellClick?.({
      title: `${project.projectName} / ${group.entityName}`,
      subtitle: `${mode} — ${project.projectName}`,
      formula: `Transacciones de ${group.entityName} en ${project.projectName}`,
      budgets: group.budgets,
      ejecuciones: group.ejecuciones,
      value,
      presupuestado: group.totalPresupuestado,
      ejecutado: group.totalEjecutado,
      diferencia: group.diferencia,
      mode,
      tipo: (group.budgets[0]?.tipo || group.ejecuciones[0]?.tipo || 'ingreso') as 'ingreso' | 'egreso',
    });
  };

  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <p className="text-xs text-slate-500 italic text-center py-6 bg-slate-50 rounded-lg">No hay datos disponibles</p>
      )}
      {projects.map(project => (
        <div key={project.projectId} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Project header */}
          <button
            onClick={() => toggleProject(project.projectId)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{expandedProjects.has(project.projectId) ? '▼' : '▶'}</span>
              <span className="text-sm font-bold text-slate-800">{project.projectName}</span>
              <span className="text-[10px] text-slate-400 font-medium">({project.groups.length} terceros)</span>
            </div>
            <span className="text-xs font-bold text-slate-700">{formatCurrency(mode === 'Presupuestado' ? project.totalPresupuestado : project.totalEjecutado)}</span>
          </button>

          {/* Tercero rows */}
          {expandedProjects.has(project.projectId) && (
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[9px] font-bold uppercase text-slate-400 bg-white">
                <div className="col-span-4">Tercero</div>
                <div className="col-span-2 text-center">Tipo</div>
                <div className="col-span-2 text-right">Presupuestado</div>
                <div className="col-span-2 text-right">Ejecutado</div>
                <div className="col-span-2 text-right">Diferencia</div>
              </div>
              {project.groups.map(group => (
                <button
                  key={group.entityId}
                  onClick={() => handleTerceroClick(project, group)}
                  className="w-full grid grid-cols-12 gap-2 px-4 py-3 hover:bg-indigo-50/50 transition-colors text-left items-center"
                >
                  <div className="col-span-4">
                    <p className="text-xs font-semibold text-slate-700 truncate">{group.entityName}</p>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <EntityTypeBadge type={group.entityType} />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-xs font-bold text-slate-700">{formatCurrency(group.totalPresupuestado)}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-xs font-bold text-slate-700">{formatCurrency(group.totalEjecutado)}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={clsx("text-xs font-black", group.diferencia === 0 ? "text-slate-400" : group.diferencia > 0 ? "text-emerald-600" : "text-rose-600")}>
                      {group.diferencia > 0 ? '+' : ''}{formatCurrency(group.diferencia)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
