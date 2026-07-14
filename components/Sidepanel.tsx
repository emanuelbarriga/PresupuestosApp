'use client'

import { NavScreen, Project, EntityType, ViewType } from '@/lib/types';
import { FileText, CheckCircle, FolderKanban, Users, CreditCard, Building2, Settings } from 'lucide-react';
import clsx from 'clsx';
import { CustomizePanel } from '@/components/panels/CustomizePanel';
import { useCompanyStore } from '@/stores/companyStore';
import { Tooltip } from './Tooltip';
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
import { ErConfigPanel } from '@/components/panels/ErConfigPanel';
import { BulkEditTerceroPanel } from '@/components/entities/tercero/BulkEditTerceroPanel';
import { BulkEditPresupuestosPanel } from '@/components/entities/presupuesto/BulkEditPresupuestosPanel';
import { BulkEditEjecucionesPanel } from '@/components/entities/ejecucion/BulkEditEjecucionesPanel';

interface SidepanelProps {
  screen: NavScreen | undefined;
  companyId: string;
  activeView?: ViewType;
  onClose: () => void;
  onSubmit: (action: {
    mode: 'create' | 'edit' | 'archive' | 'delete';
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
    case 'er-config': {
      const record = screen.record || {};
      return (
        <ErConfigPanel
          config={record.config ?? record}
          projects={record.projects || []}
          onSave={(config) => handleEntitySubmit({ mode: 'edit', entity: 'er-config', data: config })}
          onConfigChange={record.onConfigChange}
          onClose={onClose}
          onBack={onBack}
          canGoBack={canGoBack}
        />
      );
    }
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
  activeView,
}: SidepanelProps) {
  const visible = !!screen;
  const userRole = useCompanyStore(s => s.userRole);

  const handleSettings = () => {
    if (activeView === 'Dashboard') {
      onNavigate({ type: 'customize' });
    } else {
      onNavigate({ type: 'entity', entity: 'settings', mode: 'edit' });
    }
  };

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

    // Bulk-edit tercero panel
    if (screen.type === 'bulk-edit-tercero') {
      return (
        <BulkEditTerceroPanel
          selectedIds={screen.selectedIds}
          companyId={companyId}
          onClose={() => onClose()}
        />
      );
    }

    // Bulk-edit presupuesto panel
    if (screen.type === 'bulk-edit-presupuesto') {
      return (
        <BulkEditPresupuestosPanel
          selectedIds={screen.selectedIds}
          companyId={companyId}
          onClose={() => onClose()}
        />
      );
    }

    // Bulk-edit ejecucion panel
    if (screen.type === 'bulk-edit-ejecucion') {
      return (
        <BulkEditEjecucionesPanel
          selectedIds={screen.selectedIds}
          companyId={companyId}
          onClose={() => onClose()}
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
        <div className="flex flex-col items-center gap-3 mt-4">
          <Tooltip label="Presupuestado" side="left">
            <button onClick={() => onNavigate({ type: 'entity', entity: 'budget', mode: 'create', defaults: { tipo: 'credito' } })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
              <FileText size={18} />
            </button>
          </Tooltip>
          <Tooltip label="Ejecutado" side="left">
            <button onClick={() => onNavigate({ type: 'entity', entity: 'ejecucion', mode: 'create', defaults: { tipo: 'debito' } })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
              <CheckCircle size={18} />
            </button>
          </Tooltip>
          <Tooltip label="Proyecto" side="left">
            <button onClick={() => onNavigate({ type: 'entity', entity: 'project', mode: 'create' })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all">
              <FolderKanban size={18} />
            </button>
          </Tooltip>
          <Tooltip label="Tercero" side="left">
            <button onClick={() => onNavigate({ type: 'entity', entity: 'tercero', mode: 'create' })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
              <Users size={18} />
            </button>
          </Tooltip>
          <Tooltip label="Cuenta bancaria" side="left">
            <button onClick={() => onNavigate({ type: 'entity', entity: 'cuenta', mode: 'create' })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all">
              <CreditCard size={18} />
            </button>
          </Tooltip>
          <Tooltip label="Extracto" side="left">
            <button onClick={() => onNavigate({ type: 'entity', entity: 'extracto', mode: 'create' })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
              <Building2 size={18} />
            </button>
          </Tooltip>
          {(userRole === 'admin') && (
            <>
              <div className="w-6 h-px bg-slate-200 my-1" />
              <Tooltip label="Configuración" side="left">
                <button onClick={handleSettings}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                  <Settings size={18} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      ) : (
        renderContent()
      )}
    </aside>
  );
}
