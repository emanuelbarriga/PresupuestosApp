'use client';

import type { EntityProps, MovimientoBancario } from '@/lib/types';
import { PanelHeader } from '@/components/shared/PanelHeader';
import { MovimientoView } from './MovimientoView';

export function MovimientoEntity({ mode, companyId, record, defaults, onSubmit, onNavigate, onClose, onBack, canGoBack }: EntityProps) {
  const movimiento = record as MovimientoBancario | undefined;

  return (
    <div className="flex flex-col h-full w-[360px] absolute inset-0">
      <PanelHeader title="Movimiento Bancario" canGoBack={canGoBack} onBack={onBack} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
        {mode === 'view' && movimiento ? (
          <MovimientoView
            movimiento={movimiento}
            cuentaName={defaults?.cuentaName ?? ''}
            cuentaId={defaults?._cuentaId}
            extractoId={defaults?._extractoId}
            companyId={companyId}
            onNavigate={onNavigate}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-8">
            Este panel es solo de consulta.
          </p>
        )}
      </div>
    </div>
  );
}
