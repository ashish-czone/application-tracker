import Link from 'next/link';
import { Container } from './layout/Container';
import { fetchMenuBySlug, fetchSiteSettings, type SiteSettings } from '@/lib/api';
import type { PublicMenuItemDto } from '@domains/agency-ui/portals/customer';

/**
 * Site footer — vercel-light. Hairline top border on a near-white panel,
 * 4-column link grid (brand + up to 3 menu columns), mono labels, social
 * as text links, copyright row in mono. Quiet engineering aesthetic.
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

  return (
    <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr] md:gap-16">
          <div className="flex flex-col gap-5">
            <Link
              href="/"
              className="text-2xl font-semibold tracking-[-0.02em] leading-none text-[hsl(var(--foreground))]"
            >
              {settings.siteName}
            </Link>
            {settings.tagline && (
              <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                {settings.tagline}
              </p>
            )}
            <Link
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--accent))] transition-colors w-fit"
            >
              <span aria-hidden className="text-mono text-[hsl(var(--accent))]">{'>'}</span>
              {contactEmail}
            </Link>
            {socialLinks.length > 0 && (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-mono text-[hsl(var(--muted-foreground))] mt-2">
                {socialLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[hsl(var(--foreground))] transition-colors"
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

        <div className="mt-12 pt-6 border-t border-[hsl(var(--border))] flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-mono text-[hsl(var(--muted-foreground))]">
          <span>
            © {year} {copyrightName}
          </span>
          <span>Built with the starter-template platform</span>
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
        <div key={item.id} className="flex flex-col gap-3">
          <h3 className="text-eyebrow">{item.label}</h3>
          {item.children.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {item.children.map((child) => {
                const href = child.href ?? '#';
                const isExternal = /^https?:\/\//.test(href) || child.target === '_blank';
                const linkClasses =
                  'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors';
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
        <div className="flex flex-col gap-3">
          <h3 className="text-eyebrow">Contact</h3>
          <ul className="flex flex-col gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            {settings.contactEmail && (
              <li>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  {settings.contactEmail}
                </a>
              </li>
            )}
            {settings.contactPhone && (
              <li>
                <a
                  href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`}
                  className="hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  {settings.contactPhone}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
      {settings.address && (
        <div className="flex flex-col gap-3">
          <h3 className="text-eyebrow">Studio</h3>
          <p className="whitespace-pre-line text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
            {settings.address}
          </p>
        </div>
      )}
    </div>
  );
}
