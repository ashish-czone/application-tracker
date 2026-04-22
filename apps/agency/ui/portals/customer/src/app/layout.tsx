import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import '../lib/register-blocks';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { JsonLd } from '@/components/JsonLd';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';
const SITE_NAME = 'Studio';

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
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    // Social profiles plug in from F1 site-settings later; hardcoded
    // placeholders here so crawlers don't see an empty sameAs.
    sameAs: [],
  };

  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen flex flex-col">
        <JsonLd data={organization} />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
