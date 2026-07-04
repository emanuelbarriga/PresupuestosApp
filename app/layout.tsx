import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'Gestor de Presupuestos',
  description: 'Gestión, control y visualización de ingresos y egresos presupuestados vs. ejecutados',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
