import type { Metadata } from 'next';
import StoreProvider from '@/store/provider';
import ToastContainer from '@/components/ui/ToastContainer';
import Sidebar from '@/components/layout/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stock Portfolio Tracker',
  description: 'Track US stock and ETF portfolios with interactive charts and OCR-based slip parsing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <StoreProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-6">
              {children}
            </main>
          </div>
          <ToastContainer />
        </StoreProvider>
      </body>
    </html>
  );
}
