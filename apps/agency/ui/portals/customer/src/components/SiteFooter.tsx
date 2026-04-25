import Link from 'next/link';
import { Container } from './layout/Container';
import { fetchMenuBySlug, fetchSiteSettings, type SiteSettings } from '@/lib/api';
import type { PublicMenuItemDto } from '@domains/agency-ui';

/**
 * Site footer. Branding, contact, and social are read from public
 * site-settings. An optional `footer` menu renders as columns of
 * links; falling back to a minimal contact layout otherwise.
 */
export async function SiteFooter() {
  const [menu, settings] = await Promise.all([
    fetchMenuBySlug('footer'),
    fetchSiteSettings(),
  ]);
  const year = new Date().getFullYear();
  const socialLinks = buildSocialLinks(settings);
  const copyrightName = settings.companyName || settings.siteName;

  return (
    <footer className="mt-24 bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
      <Container className="py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_2fr] md:gap-16">
          <div className="space-y-5">
            <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
              {settings.siteName}
            </Link>
            {settings.tagline && (
              <p className="max-w-sm text-sm text-[hsl(var(--background)/0.7)]">
                {settings.tagline}
              </p>
            )}
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-4 text-sm text-[hsl(var(--background)/0.7)]">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[hsl(var(--background))] transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {menu && menu.items.length > 0 ? (
            <FooterColumns items={menu.items} />
          ) : (
            <FooterContactFallback settings={settings} />
          )}
        </div>

        <div className="mt-16 pt-8 border-t border-[hsl(var(--background)/0.1)] flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-[hsl(var(--background)/0.6)]">
          <span>© {year} {copyrightName}. All rights reserved.</span>
          <span>Built with the starter-template platform.</span>
        </div>
      </Container>
    </footer>
  );
}

function buildSocialLinks(settings: SiteSettings): Array<{ label: string; href: string }> {
  const candidates: Array<{ label: string; href: string }> = [
    { label: 'Twitter', href: settings['social.twitter'] },
    { label: 'LinkedIn', href: settings['social.linkedin'] },
    { label: 'Instagram', href: settings['social.instagram'] },
    { label: 'GitHub', href: settings['social.github'] },
    { label: 'YouTube', href: settings['social.youtube'] },
  ];
  return candidates.filter((link) => link.href.length > 0);
}

function FooterColumns({ items }: { items: PublicMenuItemDto[] }) {
  return (
    <div className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-10">
      {items.map((item) => (
        <div key={item.id} className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--background)/0.5)]">
            {item.label}
          </h3>
          {item.children.length > 0 && (
            <ul className="space-y-2 text-sm">
              {item.children.map((child) => {
                const href = child.href ?? '#';
                const isExternal = /^https?:\/\//.test(href) || child.target === '_blank';
                return (
                  <li key={child.id}>
                    {isExternal ? (
                      <a
                        href={href}
                        target={child.target === '_blank' ? '_blank' : undefined}
                        rel={child.target === '_blank' ? 'noopener noreferrer' : undefined}
                        className="text-[hsl(var(--background)/0.7)] hover:text-[hsl(var(--background))] transition-colors"
                      >
                        {child.label}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className="text-[hsl(var(--background)/0.7)] hover:text-[hsl(var(--background))] transition-colors"
                      >
                        {child.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function FooterContactFallback({ settings }: { settings: SiteSettings }) {
  const hasContact =
    settings.contactEmail || settings.contactPhone || settings.address;
  if (!hasContact) return null;

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 md:gap-10 text-sm">
      {(settings.contactEmail || settings.contactPhone) && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--background)/0.5)]">
            Contact
          </h3>
          <ul className="space-y-2 text-[hsl(var(--background)/0.7)]">
            {settings.contactEmail && (
              <li>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="hover:text-[hsl(var(--background))] transition-colors"
                >
                  {settings.contactEmail}
                </a>
              </li>
            )}
            {settings.contactPhone && (
              <li>
                <a
                  href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`}
                  className="hover:text-[hsl(var(--background))] transition-colors"
                >
                  {settings.contactPhone}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
      {settings.address && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--background)/0.5)]">
            Studio
          </h3>
          <p className="whitespace-pre-line text-[hsl(var(--background)/0.7)]">
            {settings.address}
          </p>
        </div>
      )}
    </div>
  );
}
