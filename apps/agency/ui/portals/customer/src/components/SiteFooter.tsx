import Link from 'next/link';
import { Container } from './layout/Container';
import { fetchMenuBySlug } from '@/lib/api';
import type { PublicMenuItemDto } from '@packages/menus-ui-frontend';

/**
 * Site footer. Fetches an optional `footer` menu — each top-level
 * item becomes a column, children become links. Fails gracefully
 * when no footer menu exists (authors haven't created one yet); the
 * brand + copyright row still renders.
 *
 * Branding, contact, and social links are hardcoded placeholders
 * until F1 wires site-settings.
 */
export async function SiteFooter() {
  const menu = await fetchMenuBySlug('footer');
  const siteName = 'Studio';
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
      <Container className="py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.2fr_2fr] md:gap-16">
          <div className="space-y-5">
            <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
              {siteName}
            </Link>
            <p className="max-w-sm text-sm text-[hsl(var(--background)/0.7)]">
              A studio for brands with something to say.
            </p>
            <div className="flex items-center gap-4 text-sm text-[hsl(var(--background)/0.7)]">
              <a
                href="https://twitter.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[hsl(var(--background))] transition-colors"
              >
                Twitter
              </a>
              <a
                href="https://linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[hsl(var(--background))] transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[hsl(var(--background))] transition-colors"
              >
                Instagram
              </a>
            </div>
          </div>

          {menu && menu.items.length > 0 ? (
            <FooterColumns items={menu.items} />
          ) : (
            <FooterColumnsFallback />
          )}
        </div>

        <div className="mt-16 pt-8 border-t border-[hsl(var(--background)/0.1)] flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-[hsl(var(--background)/0.6)]">
          <span>© {year} {siteName}. All rights reserved.</span>
          <span>Built with the starter-template platform.</span>
        </div>
      </Container>
    </footer>
  );
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

function FooterColumnsFallback() {
  return (
    <div className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-10 text-sm">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--background)/0.5)]">
          Studio
        </h3>
        <ul className="space-y-2 text-[hsl(var(--background)/0.7)]">
          <li>Work</li>
          <li>About</li>
          <li>Journal</li>
        </ul>
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--background)/0.5)]">
          Contact
        </h3>
        <ul className="space-y-2 text-[hsl(var(--background)/0.7)]">
          <li>hello@studio.example</li>
          <li>+1 (555) 000-0000</li>
        </ul>
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--background)/0.5)]">
          Elsewhere
        </h3>
        <ul className="space-y-2 text-[hsl(var(--background)/0.7)]">
          <li>Newsletter</li>
          <li>Press</li>
          <li>Careers</li>
        </ul>
      </div>
    </div>
  );
}
