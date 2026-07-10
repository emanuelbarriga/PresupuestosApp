'use client'

import { NavScreen, Project, EntityType } from '@/lib/types';
import { FileText, Filter, Bell, Settings } from 'lucide-react';
import clsx from 'clsx';
import { CustomizePanel } from '@/components/panels/CustomizePanel';
import { TerceroGroupPanel } from '@/components/panels/TerceroGroupPanel';
import { EntityList } from '@/components/entities/EntityList';
import { BudgetEntity } from '@/components/entities/budget/BudgetEntity';
import { EjecucionEntity } from '@/components/entities/ejecucion/EjecucionEntity';
import { ProjectEntity } from '@/components/entities/project/ProjectEntity';
import { TerceroEntity } from '@/components/entities/tercero/TerceroEntity';
import { CuentaEntity } from '@/components/entities/cuenta/CuentaEntity';
import { ExtractoEntity } from '@/components/entities/extracto/ExtractoEntity';
import { MovimientoEntity } from '@/components/entities/movimiento/MovimientoEntity';
import { ConvertirMovimientosEntity } from '@/components/entities/convertir-movimientos/ConvertirMovimientosEntity';
import { SettingsEntity } from '@/components/entities/settings/SettingsEntity';
import { InvitacionEntity } from '@/components/entities/invitacion/InvitacionEntity';
import { ColaboradorEntity } from '@/components/entities/colaborador/ColaboradorEntity';
import { CompaniaEntity } from '@/components/entities/compania/CompaniaEntity';

interface SidepanelProps {
  screen: NavScreen | undefined;
  companyId: string;
  onClose: () => void;
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive';
    entity: EntityType;
    record?: any;
    data: Record<string, any>;
  }) => Promise<void>;
  onNavigate: (screen: NavScreen) => void;
  onBack: () => void;
  canGoBack: boolean;
  // Dashboard customization props (for CustomizePanel)
  projects?: Project[];
  selectedProjects?: Set<string>;
  projectSearch?: string;
  onProjectsChange?: (selected: Set<string>) => void;
  onSearchChange?: (search: string) => void;
}

function renderEntityScreen(
  screen: { entity: EntityType; mode: 'create' | 'edit' | 'view'; record?: any; defaults?: Record<string, string>; year?: number; filterTipo?: any; filterMode?: any },
  companyId: string,
  handleEntitySubmit: SidepanelProps['onSubmit'],
  onNavigate: SidepanelProps['onNavigate'],
  onClose: SidepanelProps['onClose'],
  onBack: SidepanelProps['onBack'],
  canGoBack: boolean,
) {
  const entityProps = {
    mode: screen.mode,
    companyId,
    record: screen.record,
    defaults: screen.defaults,
    year: screen.year,
    filterTipo: screen.filterTipo,
    filterMode: screen.filterMode,
    onSubmit: handleEntitySubmit,
    onNavigate,
    onClose,
    onBack,
    canGoBack,
  };

  // Dynamic key to force React remount when the target changes:
  // - Create mode: defaults vary (different cell clicked)
  // - Settings entity: record.category varies (different settings tab)
  // - All others: record.id changes
  const key = screen.mode === 'create'
    ? `${screen.entity}-create-${JSON.stringify(screen.defaults || {})}`
    : screen.entity === 'settings'
      ? `settings-edit-${(screen.record as any)?.category || 'default'}`
      : `${screen.entity}-${screen.mode}-${screen.record?.id || 'new'}`;

  switch (screen.entity) {
    case 'budget':
      return <BudgetEntity key={key} {...entityProps} />;
    case 'ejecucion':
      return <EjecucionEntity key={key} {...entityProps} />;
    case 'project':
      return <ProjectEntity key={key} {...entityProps} />;
    case 'tercero':
      return <TerceroEntity key={key} {...entityProps} />;
    case 'cuenta':
      return <CuentaEntity key={key} {...entityProps} />;
    case 'extracto':
      return <ExtractoEntity key={key} {...entityProps} />;
    case 'movimiento':
      return <MovimientoEntity key={key} {...entityProps} />;
    case 'convertir-movimientos':
      return <ConvertirMovimientosEntity key={key} {...entityProps} />;
    case 'settings':
      return <SettingsEntity key={key} {...entityProps} />;
    case 'invitacion':
      return <InvitacionEntity key={key} {...entityProps} />;
    case 'colaborador':
      return <ColaboradorEntity key={key} {...entityProps} />;
    case 'compania':
      return <CompaniaEntity key={key} {...entityProps} />;
    default:
      return null;
  }
}

export function Sidepanel({
  screen,
  companyId,
  onClose,
  onSubmit,
  onNavigate,
  onBack,
  canGoBack,
  projects = [],
  selectedProjects = new Set(),
  projectSearch = '',
  onProjectsChange,
  onSearchChange,
}: SidepanelProps) {
  const visible = !!screen;

  const renderContent = () => {
    if (!screen) return null;

    // Entity+mode routing
    if (screen.type === 'entity') {
      return renderEntityScreen(screen, companyId, onSubmit, onNavigate, onClose, onBack, canGoBack);
    }

    // Entity-list (dashboard data) — EntityList handles its own PanelHeader
    if (screen.type === 'entity-list') {
      const { data } = screen;
      return (
        <EntityList
          mode={data.mode}
          tipo={data.tipo}
          title={data.title}
          subtitle={data.subtitle}
          budgets={data.budgets}
          ejecuciones={data.ejecuciones}
          presupuestado={data.presupuestado}
          ejecutado={data.ejecutado}
          diferencia={data.diferencia}
          onNavigate={onNavigate}
          onClose={onClose}
          onBack={onBack}
          canGoBack={canGoBack}
          onSubmit={onSubmit}
        />
      );
    }

    // Customize panel
    if (screen.type === 'customize') {
      return (
        <CustomizePanel
          projects={projects}
          selectedProjects={selectedProjects}
          projectSearch={projectSearch}
          onProjectsChange={onProjectsChange}
          onSearchChange={onSearchChange}
          canGoBack={canGoBack}
          onBack={onBack}
          onClose={onClose}
        />
      );
    }

    // Detalle-tercero (preserved legacy panel)
    if (screen.type === 'view' && 'detail' in screen && screen.detail.type === 'detalle-tercero') {
      return (
        <div className="flex flex-col h-full w-[360px] absolute inset-0">
          {/* PanelHeader is rendered by the caller or inline */}
          <TerceroGroupPanel
            projects={screen.detail.projects}
            onCellClick={(data) => onNavigate({ type: 'entity-list', data })}
            mode="Presupuestado"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <aside
      className={clsx(
        'bg-white border-l border-slate-200 flex flex-col h-full transition-all duration-300 ease-out shrink-0 overflow-hidden relative',
        visible ? 'w-[360px]' : 'w-16 items-center py-4',
      )}
    >
      {!visible ? (
        <div className="flex flex-col gap-6 w-full items-center text-slate-400">
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl">
            <FileText size={20} />
          </button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl">
            <Filter size={20} />
          </button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl">
            <Bell size={20} />
          </button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl mt-auto">
            <Settings size={20} />
          </button>
        </div>
      ) : (
        renderContent()
      )}
    </aside>
  );
}
