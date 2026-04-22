import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Search,
  Command as CommandIcon,
  Moon,
  Sun,
  Bell,
  User,
  Settings,
  KeyRound,
  LogOut,
  SlidersHorizontal,
  Layers,
  Building2,
  Shield,
  Users as UsersIcon,
  Wrench,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  AvatarBadge,
} from '@packages/ui';
import { useUnreadCount } from '@packages/notification-channels-ui';
import { ScreenPreviewNav, type ScreenKey } from './ScreenPreviewNav';
import { NotificationPanel } from './NotificationPanel';

export function ScreenPreviewTopBar({ active }: { active: ScreenKey }) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  const unreadCount = unread?.count ?? 0;

  const toggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('dark', next);
      }
      return next;
    });
  };

  return (
    <div className="border-b border-rule bg-paper-raised">
      <div className="max-w-[1480px] mx-auto px-10 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-2xl italic text-ink leading-none">
            Compliance<span className="text-signal">.</span>
          </span>
          <ScreenPreviewNav active={active} />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 border border-rule hover:border-ink text-[11px] text-ink-muted hover:text-ink font-sans transition-colors"
          >
            <Search className="w-3 h-3" strokeWidth={1.5} />
            <span>Search or command</span>
            <span className="ml-4 flex items-center gap-0.5 font-mono text-[10px] text-ink-muted/80">
              <CommandIcon className="w-3 h-3" strokeWidth={1.5} />K
            </span>
          </button>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen(true)}
            className="relative flex items-center justify-center w-8 h-8 border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
          >
            <Bell className="w-3.5 h-3.5" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-signal text-paper text-[9px] font-mono font-semibold tabular-nums px-1"
              >
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-8 h-8 border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open workspace menu"
                className="flex items-center justify-center w-8 h-8 border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors outline-none focus-visible:outline-none"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="rounded-none border-rule bg-paper-raised text-ink p-0 min-w-[240px] shadow-none"
            >
              <DropdownMenuLabel className="px-4 py-3 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium border-b border-rule">
                Workspace
              </DropdownMenuLabel>
              <div className="p-1">
                <DropdownMenuItem asChild>
                  <Link
                    to="/global-sets"
                    className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer flex items-center"
                  >
                    <Layers className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                    Global Sets
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/org-hierarchy"
                    className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer flex items-center"
                  >
                    <Building2 className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                    Organisation
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/compliance-roles"
                    className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer flex items-center"
                  >
                    <Shield className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                    Roles & Permissions
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/compliance-users"
                    className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer flex items-center"
                  >
                    <UsersIcon className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                    Users
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/admin-settings"
                    className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer flex items-center"
                  >
                    <Wrench className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                    Admin Settings
                  </Link>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open user menu"
                className="flex items-center gap-2 pl-4 border-l border-rule outline-none focus-visible:outline-none group"
              >
                <AvatarBadge initials="DI" size="md" className="group-hover:opacity-90 transition-opacity" />
                <div className="text-right">
                  <div className="text-xs text-ink font-sans leading-none">Deepak Iyer</div>
                  <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">
                    Partner
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="rounded-none border-rule bg-paper-raised text-ink p-0 min-w-[220px] shadow-none"
            >
              <div className="px-4 py-3 border-b border-rule">
                <div className="text-sm text-ink font-sans leading-tight">Deepak Iyer</div>
                <div className="text-[11px] text-ink-muted font-serif italic mt-0.5">
                  deepak@firm.example
                </div>
              </div>
              <div className="p-1">
                <DropdownMenuItem
                  className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer"
                  onSelect={() => navigate('/compliance-settings')}
                >
                  <User className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer"
                  onSelect={() => navigate('/compliance-settings')}
                >
                  <Settings className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-none px-3 py-2 text-xs font-sans text-ink focus:bg-paper focus:text-ink cursor-pointer"
                  onSelect={() => navigate('/compliance-settings')}
                >
                  <KeyRound className="w-3.5 h-3.5 mr-2 text-ink-muted" strokeWidth={1.5} />
                  Change password
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator className="bg-rule my-0" />
              <div className="p-1">
                <DropdownMenuItem className="rounded-none px-3 py-2 text-xs font-sans text-signal focus:bg-paper focus:text-signal cursor-pointer">
                  <LogOut className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                  Sign out
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <NotificationPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
}
