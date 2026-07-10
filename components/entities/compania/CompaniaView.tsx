'use client';

import { DF } from '@/components/shared/DF';

interface CompaniaViewProps {
  name: string;
  createdAt?: string;
}

export function CompaniaView({ name, createdAt }: CompaniaViewProps) {
  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric',
    }) : '—';

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase">Detalle de la Empresa</p>

      <DF label="Nombre" v={name} />

      <DF label="Creada" v={formatDate(createdAt)} />
    </div>
  );
}
