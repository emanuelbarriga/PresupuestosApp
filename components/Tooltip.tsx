'use client'

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
  side?: 'left' | 'right';
}

export function Tooltip({ label, children, accent, side = 'right' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (show && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const top = rect.top + rect.height / 2;
      const left = side === 'left' ? rect.left - 4 : rect.right + 4;
      setPos({ top, left });
    }
  }, [show, side]);

  const enter = () => {
    timer.current = window.setTimeout(() => setShow(true), 150);
  };

  const leave = () => {
    window.clearTimeout(timer.current);
    setShow(false);
  };

  const isLeft = side === 'left';
  const arrowColor = accent ? '#4338ca' : '#0f172a';

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {show && createPortal(
        <div
          className={[
            'fixed px-3 py-1.5 text-xs rounded-md whitespace-nowrap z-50 pointer-events-none shadow-lg flex items-center gap-2',
            accent ? 'bg-indigo-700 text-indigo-50' : 'bg-slate-900 text-white',
          ].join(' ')}
          style={{
            top: pos.top,
            left: pos.left,
            transform: isLeft ? 'translateX(-100%) translateY(-50%)' : 'translateY(-50%)',
          }}
          role="tooltip"
        >
          {/* Arrow pointing to trigger */}
          <div
            className={[
              'absolute top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent',
              isLeft ? 'left-full border-l-[5px]' : 'right-full border-r-[5px]',
            ].join(' ')}
            style={isLeft ? { borderLeftColor: arrowColor } : { borderRightColor: arrowColor }}
          />
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}
