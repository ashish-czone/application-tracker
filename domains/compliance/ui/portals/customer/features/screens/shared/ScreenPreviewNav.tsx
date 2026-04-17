import { Link } from 'react-router';

export type ScreenKey = 'dashboard' | 'clients' | 'obligations' | 'filings' | 'org-hierarchy' | 'roles' | 'users' | 'reports';

const ITEMS: Array<{ key: ScreenKey; label: string; href: string }> = [
  { key: 'dashboard', label: 'Dashboard', href: '/screens/dashboard' },
  { key: 'clients', label: 'Clients', href: '/screens/clients' },
  { key: 'obligations', label: 'Laws', href: '/screens/obligations' },
  { key: 'filings', label: 'Filings', href: '/screens/filings' },
  { key: 'org-hierarchy', label: 'Organisation', href: '/screens/org-hierarchy' },
  { key: 'roles', label: 'Roles', href: '/screens/roles' },
  { key: 'users', label: 'Users', href: '/screens/users' },
  { key: 'reports', label: 'Reports', href: '/screens/reports' },
];

export function ScreenPreviewNav({ active }: { active: ScreenKey }) {
  return (
    <nav className="flex items-center gap-6 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-soft">
      {ITEMS.map((item) => {
        const className =
          item.key === active ? 'text-ink border-b border-ink pb-0.5' : 'hover:text-ink';
        if (item.href === '#') {
          return (
            <a key={item.key} href="#" className={className}>
              {item.label}
            </a>
          );
        }
        return (
          <Link key={item.key} to={item.href} className={className}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
