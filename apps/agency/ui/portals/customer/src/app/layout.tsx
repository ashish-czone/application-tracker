import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import '../lib/register-blocks';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { JsonLd } from '@/components/JsonLd';
import { Analytics } from '@/components/Analytics';
import { fetchSiteSettings, type SiteSettings } from '@/lib/api';
import { buildThemeStyleCss, NO_FLASH_SCRIPT } from '@/lib/theme';
import { SKIN_NO_FLASH_SCRIPT } from '@/lib/skin';
import { SkinSwitcher } from '@/components/SkinSwitcher';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSiteSettings();
  const defaultTitle = settings['defaultSeo.title'] || settings.siteName;
  const description = settings['defaultSeo.description'] || settings.description;
  const ogImage = settings['defaultSeo.ogImage'] || undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: defaultTitle, template: `%s | ${settings.siteName}` },
    description,
    openGraph: {
      siteName: settings.siteName,
      title: defaultTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: 'website',
      url: SITE_URL,
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await fetchSiteSettings();
  const organization = buildOrganizationSchema(settings);
  const themeCss = buildThemeStyleCss(settings.theme);

  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SKIN_NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <JsonLd data={organization} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[hsl(var(--foreground))] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[hsl(var(--background))]"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        <SkinSwitcher />
        <Analytics ga4={settings['analytics.ga4']} posthog={settings['analytics.posthog']} />
      </body>
    </html>
  );
}

function buildOrganizationSchema(settings: SiteSettings) {
  const sameAs = [
    settings['social.twitter'],
    settings['social.linkedin'],
    settings['social.instagram'],
    settings['social.github'],
    settings['social.youtube'],
  ].filter((url) => url.length > 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.companyName || settings.siteName,
    url: SITE_URL,
    ...(settings.description ? { description: settings.description } : {}),
    ...(settings.companyLogo ? { logo: settings.companyLogo } : {}),
    ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
    ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}
