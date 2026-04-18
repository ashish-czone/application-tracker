import { Link } from 'react-router';
import { Search, Command as CommandIcon, Moon, Sun } from 'lucide-react';
import { AvatarBadge, cn } from '@packages/ui';

export interface ConsoleHeaderBarUser {
  initials: string;
  name: string;
  role: string;
}

export interface ConsoleHeaderBarNavItem {
  label: string;
  to: string;
  active?: boolean;
}

export interface ConsoleHeaderBarProps {
  /** Wordmark shown at the far left. The trailing dot is signal-toned automatically. */
  wordmark?: string;
  nav: ConsoleHeaderBarNavItem[];
  user: ConsoleHeaderBarUser;
  isDark: boolean;
  onToggleDark: () => void;
  onSearchOpen: () => void;
  className?: string;
}

/**
 * Top application chrome for Compliance portals: wordmark, nav row, ⌘K
 * search-as-command affordance, dark-mode toggle, and the user chip.
 */
export function ConsoleHeaderBar({
  wordmark = 'Compliance',
  nav,
  user,
  isDark,
  onToggleDark,
  onSearchOpen,
  className,
}: ConsoleHeaderBarProps) {
  return (
    <div className={cn('border-b border-rule bg-paper-raised', className)}>
      <div className="max-w-[1480px] mx-auto px-10 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-2xl italic text-ink leading-none">
            {wordmark}
            <span className="text-signal">.</span>
          </span>
          <nav className="flex items-center gap-6 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-soft">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={item.active ? 'text-ink border-b border-ink pb-0.5' : 'hover:text-ink'}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onSearchOpen}
            className="flex items-center gap-2 px-3 py-1.5 border border-rule hover:border-ink text-[11px] text-ink-muted hover:text-ink font-sans transition-colors group"
          >
            <Search className="w-3 h-3" strokeWidth={1.5} />
            <span>Search or command</span>
            <span className="ml-4 flex items-center gap-0.5 font-mono text-[10px] text-ink-muted/80">
              <CommandIcon className="w-3 h-3" strokeWidth={1.5} />K
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-8 h-8 border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </button>

          <div className="flex items-center gap-2 pl-4 border-l border-rule">
            <AvatarBadge initials={user.initials} size="md" />
            <div className="text-right">
              <div className="text-xs text-ink font-sans leading-none">{user.name}</div>
              <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">
                {user.role}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
