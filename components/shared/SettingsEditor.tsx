'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react';
import { updateSettings } from '@/lib/firestore';
import { PanelHeader } from '@/components/shared/PanelHeader';

interface SettingsEditorProps {
  category: string;
  title: string;
  items: any[];
  companyId: string;
  onClose: () => void;
}

export function SettingsEditor({ category, title, items, companyId, onClose }: SettingsEditorProps) {
  const [localItems, setLocalItems] = useState([...items]);
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    setLocalItems(prev => [...prev, { name: '', color: '#6366f1', order: prev.length }]);
  };

  const handleUpdate = (index: number, field: string, value: any) => {
    setLocalItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleDelete = (index: number) => {
    setLocalItems(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    setLocalItems(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, i) => ({ ...item, order: i }));
    });
  };

  const handleSave = async () => {
    if (localItems.some((i: any) => !i.name.trim())) return;
    setSaving(true);
    const updatePayload = { [category]: localItems.map((item: any, i: number) => ({ ...item, order: i })) };
    await updateSettings(updatePayload);
    setSaving(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title={title} canGoBack={false} onBack={() => {}} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {localItems.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => handleMove(index, 'up')} disabled={index === 0}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
              <button onClick={() => handleMove(index, 'down')} disabled={index === localItems.length - 1}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
            </div>
            <input type="color" value={item.color} onChange={e => handleUpdate(index, 'color', e.target.value)}
              className="w-8 h-8 rounded border border-slate-300 cursor-pointer shrink-0" />
            <input type="text" value={item.name} onChange={e => handleUpdate(index, 'name', e.target.value)}
              placeholder="Nombre..." className="flex-1 border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none" />
            <button onClick={() => handleDelete(index)}
              className="text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
        <button onClick={handleAdd}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-3 rounded-lg transition-colors">
          <Plus size={14} /> Agregar
        </button>
      </div>
      <div className="p-6 border-t border-slate-100 shrink-0">
        <button onClick={handleSave} disabled={saving || localItems.some((i: any) => !i.name.trim())}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-2">
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
