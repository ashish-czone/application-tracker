import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import '../lib/register-blocks';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Fraunces — a contemporary serif with optical-size and a soft
// geometric feel. Reads editorial without being old-fashioned and
// pairs cleanly with Inter for body copy.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
  axes: ['opsz', 'SOFT'],
});

export const metadata: Metadata = {
  title: { default: 'Agency Site', template: '%s | Agency Site' },
  description: 'A modern agency marketing site, powered by the starter-template platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
