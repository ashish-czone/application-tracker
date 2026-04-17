import { Link } from 'react-router';

export type ScreenKey =
  | 'dashboard'
  | 'clients'
  | 'laws'
  | 'obligations'
  | 'filings'
  | 'reports'
  | 'org-hierarchy'
  | 'roles'
  | 'users'
  | 'global-sets';

const ITEMS: Array<{ key: ScreenKey; label: string; href: string }> = [
  { key: 'dashboard', label: 'Dashboard', href: '/screens/dashboard' },
  { key: 'clients', label: 'Clients', href: '/screens/clients' },
  { key: 'laws', label: 'Laws', href: '/screens/laws' },
  { key: 'obligations', label: 'Obligations', href: '/screens/obligations' },
  { key: 'filings', label: 'Filings', href: '/screens/filings' },
  { key: 'reports', label: 'Reports', href: '/screens/reports' },
];

export function ScreenPreviewNav({ active }: { active: ScreenKey }) {
  return (
    <nav className="flex items-center gap-6 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-soft">
      {ITEMS.map((item) => {
        const className =
          item.key === active ? 'text-ink border-b border-ink pb-0.5' : 'hover:text-ink';
        return (
          <Link key={item.key} to={item.href} className={className}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
