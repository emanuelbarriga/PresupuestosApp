'use client'

import { Hammer } from 'lucide-react';
import { ViewType } from '@/lib/types';

export function Construction({ view }: { view: ViewType }) {
  return (
    <div className="flex-1 flex flex-col h-full w-full">
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">{view}</h1>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-transparent">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <Hammer size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sección en Construcción</h2>
          <p className="text-[11px] text-slate-500">
            La vista de <span className="font-bold text-slate-700">{view}</span> está siendo desarrollada.
          </p>
        </div>
      </div>
    </div>
  );
}
