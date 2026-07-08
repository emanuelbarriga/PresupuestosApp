'use client';

import React from 'react';
import clsx from 'clsx';

interface CalculatorProps {
  value: string;
  onChange: (v: string) => void;
  onResult: (res: number) => void;
}

/**
 * Inline calculator widget used inside BudgetForm, EjecucionForm, and FormPanel.
 * Provides basic arithmetic operations (+,-,*,/) with parentheses and decimal support.
 */
export function Calculator({ value, onChange, onResult }: CalculatorProps) {
  const handleButton = (val: string) => {
    if (val === '=') {
      try {
        const result = Function(`"use strict"; return (${value})`)();
        onResult(result);
      } catch { /* ignore */ }
    } else if (val === 'C') {
      onChange('');
    } else {
      onChange(value + val);
    }
  };

  const buttons = ['7','8','9','+','4','5','6','-','1','2','3','*','0','.','C','/','(',')','='];

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-1">
      <div className="bg-white rounded p-2 text-right text-sm font-mono mb-2 min-h-[28px] border border-slate-100">{value}</div>
      <div className="grid grid-cols-4 gap-1">
        {buttons.map(b => (
          <button key={b} type="button" onClick={() => handleButton(b)}
            className={clsx("p-1.5 text-xs font-bold rounded transition-colors", b === '=' ? "bg-indigo-600 text-white" : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200")}>
            {b}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onResult(Number(value) || 0)}
        className="w-full mt-2 bg-indigo-600 text-white rounded py-1 text-xs font-bold hover:bg-indigo-700 transition-colors">
        Usar este valor
      </button>
    </div>
  );
}
