import type { Metadata } from 'next';
import './globals.css';
import '../lib/register-blocks';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: { default: 'Agency Site', template: '%s | Agency Site' },
  description: 'Landing pages powered by @packages/pages-api.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
