import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Campaign — SaaS Dashboard',
  description: 'Reach Your Audience. Grow Your Business. Manage email and WhatsApp campaigns in one place.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

