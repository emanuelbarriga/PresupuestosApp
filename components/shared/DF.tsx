'use client';

import React from 'react';

interface DFProps {
  label: string;
  v: string;
}

/**
 * Display Field — simple read-only label/value pair.
 * Matches the Sidepanel.tsx pattern: uppercase label, bold value below.
 */
export function DF({ label, v }: DFProps) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5">{v}</p>
    </div>
  );
}
