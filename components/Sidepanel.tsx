'use client'

import { SidepanelData, RecordDetail, ActiveForm, NavScreen, Project, Comprobante } from '@/lib/types';
import { FileText, Filter, Bell, Settings } from 'lucide-react';
import clsx from 'clsx';
import { CustomizePanel } from '@/components/panels/CustomizePanel';
import { FormPanel } from '@/components/panels/FormPanel';
import { ViewPanel } from '@/components/panels/ViewPanel';
import { DataPanel } from '@/components/panels/DataPanel';

interface SidepanelProps {
  data: SidepanelData | null;
  recordDetail: RecordDetail | null;
  activeForm: ActiveForm | null;
  customizeOpen?: boolean;
  companyId: string;
  onClose: () => void;
  onFormSubmit: (form: ActiveForm, data: Record<string, any>) => Promise<void>;
  onCellClick?: (data: SidepanelData) => void;
  projects?: Project[];
  selectedProjects?: Set<string>;
  projectSearch?: string;
  onProjectsChange?: (selected: Set<string>) => void;
  onSearchChange?: (search: string) => void;
  canGoBack: boolean;
  onBack: () => void;
  onNavigate: (screen: NavScreen) => void;
  onSaveComprobantes?: (ejecucionId: string, comprobantes: Comprobante[]) => Promise<void>;
}

export function Sidepanel({ data, recordDetail, activeForm, customizeOpen = false, companyId, onClose, onFormSubmit, onCellClick, projects, selectedProjects = new Set(), projectSearch = '', onProjectsChange, onSearchChange, canGoBack, onBack, onNavigate }: SidepanelProps) {
  const visible = data || recordDetail || activeForm || customizeOpen;

  return (
    <aside className={clsx("bg-white border-l border-slate-200 flex flex-col h-full transition-all duration-300 ease-out shrink-0 overflow-hidden relative", visible ? "w-[360px]" : "w-16 items-center py-4")}>
      {!visible ? (
        <div className="flex flex-col gap-6 w-full items-center text-slate-400">
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"><FileText size={20} /></button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"><Filter size={20} /></button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl"><Bell size={20} /></button>
          <button className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl mt-auto"><Settings size={20} /></button>
        </div>
      ) : activeForm ? (
        <FormPanel key={`form-${JSON.stringify(activeForm)}`} form={activeForm} companyId={companyId} onClose={onClose} onSubmit={onFormSubmit} projects={projects} onBack={onBack} canGoBack={canGoBack} />
      ) : recordDetail ? (
        <ViewPanel key={`detail-${JSON.stringify(recordDetail)}`} recordDetail={recordDetail} companyId={companyId} onClose={onClose} onFormSubmit={onFormSubmit} onCellClick={onCellClick} projects={projects} onNavigate={onNavigate} canGoBack={canGoBack} onBack={onBack} />
      ) : customizeOpen ? (
        <CustomizePanel projects={projects || []} selectedProjects={selectedProjects} projectSearch={projectSearch}
          onProjectsChange={onProjectsChange} onSearchChange={onSearchChange}
          canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      ) : data ? (
        <DataPanel key={`${data.title}-${data.mode}-${data.tipo}`} data={data} companyId={companyId} onClose={onClose} projects={projects} onNavigate={onNavigate} canGoBack={canGoBack} onBack={onBack} />
      ) : null}
    </aside>
  );
}
