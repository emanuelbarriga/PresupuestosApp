'use client';

import React from 'react';

interface FormInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}

export function FormInput({ label, value, onChange, type = 'text' }: FormInputProps) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
      />
    </div>
  );
}
