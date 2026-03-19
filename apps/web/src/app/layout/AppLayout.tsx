import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  UserCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@packages/ui/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@packages/ui';
import { customerMenu } from '../../portals/customer/menu';
import { useAuth } from '../../shared/auth/hooks/useAuth';
import { useLogout } from '../../shared/auth/hooks/useLogout';

const navItems = customerMenu;

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const currentPage = navItems.find(
    (item) => (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)),
  );

  return (
    <div className="min-h-screen bg-content-bg">
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-200 lg:hidden',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-[width,transform] duration-300 ease-out',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="h-14 flex items-center shrink-0 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-primary-foreground leading-none">S</span>
            </div>
            <span
              className={cn(
                'font-semibold text-sidebar-foreground text-sm tracking-tight whitespace-nowrap transition-[opacity,width] duration-200',
                collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
              )}
            >
              Starter
            </span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2.5 pt-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-lg h-9 text-[13px] font-medium transition-colors duration-150',
                  collapsed ? 'justify-center w-full' : 'px-2.5',
                  isActive
                    ? 'bg-primary/[0.08] text-primary'
                    : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-black/[0.03]',
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span
                className={cn(
                  'transition-[opacity,width] duration-200',
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
                )}
              >
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="p-2.5 space-y-0.5 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'hidden lg:flex items-center gap-2.5 rounded-lg h-9 w-full text-[13px] font-medium text-sidebar-muted hover:text-sidebar-foreground hover:bg-black/[0.03] transition-colors duration-150',
              collapsed ? 'justify-center' : 'px-2.5',
            )}
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            ) : (
              <>
                <ChevronsLeft className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div
        className={cn(
          'min-h-screen flex flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pl-16' : 'lg:pl-60',
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-border flex items-center gap-4 px-4 lg:px-5 shrink-0">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden -ml-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Page title */}
          <h1 className="text-sm font-semibold text-foreground hidden sm:block">
            {currentPage?.label ?? 'Page'}
          </h1>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-white px-3 h-8 w-56 hover:border-ring/40 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10 transition-all">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent outline-none flex-1 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <kbd className="text-[10px] font-mono text-muted-foreground/50 border border-border rounded px-1 py-px">
              /
            </kbd>
          </div>

          {/* Notifications */}
          <button className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          </button>

          {/* User menu */}
          <UserMenu />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {user.userType.charAt(0).toUpperCase()}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium capitalize">{user.userType}</p>
          <p className="text-xs text-muted-foreground">ID: {user.userId.slice(0, 8)}...</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <UserCircle className="w-4 h-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {logoutMutation.isPending ? 'Logging out...' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
