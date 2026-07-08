'use client';

import React from 'react';
import { ArrowLeft, X } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}

export function PanelHeader({ title, canGoBack, onBack, onClose }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {canGoBack && (
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
      </div>
      <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
        <X size={20} className="text-slate-400" />
      </button>
    </div>
  );
}
