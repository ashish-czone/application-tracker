import Link from 'next/link';
import { Container } from './layout/Container';
import { fetchMenuBySlug, fetchSiteSettings, type SiteSettings } from '@/lib/api';
import type { PublicMenuItemDto } from '@domains/agency-ui/portals/customer';
import { Marquee } from '@domains/agency-ui/portals/customer';

/**
 * Site footer. Two slabs:
 *  1. A continuously scrolling display-scale "let's talk" marquee that
 *     reads as the page sign-off — links straight to the contact email.
 *  2. The compact info row: brand + tagline, footer menu (or contact
 *     fallback), social, copyright. Lives on the deep-ink panel.
 */
export async function SiteFooter() {
  const [menu, settings] = await Promise.all([
    fetchMenuBySlug('footer'),
    fetchSiteSettings(),
  ]);
  const year = new Date().getFullYear();
  const socialLinks = buildSocialLinks(settings);
  const copyrightName = settings.companyName || settings.siteName;
  const contactEmail = settings.contactEmail || 'hello@example.com';

  // Sign-off marquee — repeats the same call so the strip reads as one
  // continuous statement rather than a list of items.
  const signOffItems: string[] = [
    "Let's build something",
    contactEmail,
    'Available for new work',
    String(year),
  ];

  return (
    <footer className="mt-24 flex flex-col">
      <Link
        href={`mailto:${contactEmail}`}
        aria-label={`Email ${contactEmail}`}
        className="block hover:opacity-90 transition-opacity"
      >
        <Marquee
          items={signOffItems}
          tone="accent"
          size="xl"
          durationSec={42}
          separator="✦"
        />
      </Link>

      <div className="bg-[hsl(var(--surface-inverse))] text-[hsl(var(--surface-inverse-foreground))]">
        <Container className="py-20">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_2fr] md:gap-16">
            <div className="space-y-6">
              <Link
                href="/"
                className="font-display text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-none"
              >
                {settings.siteName}
              </Link>
              {settings.tagline && (
                <p className="max-w-sm text-base text-[hsl(var(--surface-inverse-foreground))]/70 leading-[1.55]">
                  {settings.tagline}
                </p>
              )}
              {socialLinks.length > 0 && (
                <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  {socialLinks.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[hsl(var(--surface-inverse-foreground))]/70 hover:text-[hsl(var(--surface-inverse-foreground))] transition-colors border-b border-transparent hover:border-[hsl(var(--surface-inverse-foreground))]/40 pb-0.5"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {menu && menu.items.length > 0 ? (
              <FooterColumns items={menu.items} />
            ) : (
              <FooterContactFallback settings={settings} />
            )}
          </div>

          <div className="mt-16 pt-8 border-t border-[hsl(var(--surface-inverse-foreground))]/15 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs tracking-[0.14em] uppercase text-[hsl(var(--surface-inverse-foreground))]/50">
            <span>
              © {year} {copyrightName}
            </span>
            <span>Built with the starter-template platform</span>
          </div>
        </Container>
      </div>
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
        <div key={item.id} className="space-y-4">
          <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[hsl(var(--surface-inverse-foreground))]/45">
            {item.label}
          </h3>
          {item.children.length > 0 && (
            <ul className="space-y-2 text-base">
              {item.children.map((child) => {
                const href = child.href ?? '#';
                const isExternal = /^https?:\/\//.test(href) || child.target === '_blank';
                const linkClasses =
                  'text-[hsl(var(--surface-inverse-foreground))]/85 hover:text-[hsl(var(--surface-inverse-foreground))] transition-colors';
                return (
                  <li key={child.id}>
                    {isExternal ? (
                      <a
                        href={href}
                        target={child.target === '_blank' ? '_blank' : undefined}
                        rel={child.target === '_blank' ? 'noopener noreferrer' : undefined}
                        className={linkClasses}
                      >
                        {child.label}
                      </a>
                    ) : (
                      <Link href={href} className={linkClasses}>
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
  const hasContact = settings.contactEmail || settings.contactPhone || settings.address;
  if (!hasContact) return null;

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 md:gap-10">
      {(settings.contactEmail || settings.contactPhone) && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[hsl(var(--surface-inverse-foreground))]/45">
            Contact
          </h3>
          <ul className="space-y-2 text-base text-[hsl(var(--surface-inverse-foreground))]/85">
            {settings.contactEmail && (
              <li>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="hover:text-[hsl(var(--surface-inverse-foreground))] transition-colors"
                >
                  {settings.contactEmail}
                </a>
              </li>
            )}
            {settings.contactPhone && (
              <li>
                <a
                  href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`}
                  className="hover:text-[hsl(var(--surface-inverse-foreground))] transition-colors"
                >
                  {settings.contactPhone}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
      {settings.address && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[hsl(var(--surface-inverse-foreground))]/45">
            Studio
          </h3>
          <p className="whitespace-pre-line text-base text-[hsl(var(--surface-inverse-foreground))]/85 leading-[1.55]">
            {settings.address}
          </p>
        </div>
      )}
    </div>
  );
}
