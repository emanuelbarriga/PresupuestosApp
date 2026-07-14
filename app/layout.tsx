import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/context/AuthContext';
import { CompanyProviderWrapper } from '@/app/CompanyProviderWrapper';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Gestor de Presupuestos',
  description: 'Gestión, control y visualización de ingresos y egresos presupuestados vs. ejecutados',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <CompanyProviderWrapper>
            {children}
          </CompanyProviderWrapper>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
