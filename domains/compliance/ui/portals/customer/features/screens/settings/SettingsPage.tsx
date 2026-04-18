import { useState, useMemo, type ReactElement } from 'react';
import {
  User,
  ShieldCheck,
  Bell,
  Palette,
  ScrollText,
  ChevronRight,
  Camera,
  Smartphone,
  Monitor,
  Globe,
  Search,
  Eye,
  EyeOff,
  LogOut,
  Sun,
  Moon,
  Laptop,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import {
  Button,
  DataGridShell,
  Eyebrow,
  type DataTableColumn,
} from '@packages/ui';
import { OrdinalDate } from '../../../../../kit';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  CURRENT_USER,
  ACTIVE_SESSIONS,
  NOTIFICATION_CATEGORIES,
  ACTIVITY_LOG,
  SETTINGS_SECTIONS,
  type SettingsSection,
  type ActiveSession,
  type NotificationCategory,
  type ActivityEntry,
  type ThemeMode,
  type Density,
} from './settingsMock';

// ─── Constants ──────────────────────────────────────────────────────

const SECTION_ICONS: Record<SettingsSection, typeof User> = {
  profile: User,
  security: ShieldCheck,
  notifications: Bell,
  appearance: Palette,
  activity: ScrollText,
};

// ─── Sub-components ─────────────────────────────────────────────────

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  readOnly,
  placeholder,
}: {
  value: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      defaultValue={value}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none transition-colors ${
        readOnly
          ? 'bg-paper-sunken text-ink-muted cursor-not-allowed'
          : 'focus:border-ink'
      }`}
    />
  );
}

function PasswordInput({ placeholder }: { placeholder: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-9 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
      >
        {visible ? (
          <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
        ) : (
          <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-none items-center border transition-colors ${
        checked
          ? 'bg-authority border-authority'
          : 'bg-paper-sunken border-rule'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 bg-paper-raised border border-rule transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function SectionDivider() {
  return <div className="border-t border-rule" />;
}

// ─── Profile section ────────────────────────────────────────────────

function ProfileSection() {
  const user = CURRENT_USER;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Profile</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Your personal information and account details.
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative group">
          <span
            aria-hidden
            className="w-16 h-16 flex items-center justify-center text-lg font-sans font-semibold text-paper-raised"
            style={{ backgroundColor: user.color }}
          >
            {user.initials}
          </span>
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/40 transition-colors"
          >
            <Camera className="w-4 h-4 text-paper-raised opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
          </button>
        </div>
        <div>
          <p className="text-sm font-sans text-ink">{user.firstName} {user.lastName}</p>
          <p className="text-[11px] font-serif italic text-ink-muted mt-0.5">
            {user.positions[0]?.title}, {user.positions[0]?.unit}
          </p>
          <button
            type="button"
            className="mt-1 text-[10px] uppercase tracking-eyebrow font-sans font-medium text-authority hover:text-authority-soft transition-colors"
          >
            Change photo
          </button>
        </div>
      </div>

      <SectionDivider />

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="First name">
          <TextInput value={user.firstName} />
        </FieldGroup>
        <FieldGroup label="Last name">
          <TextInput value={user.lastName} />
        </FieldGroup>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Email address">
          <TextInput value={user.email} readOnly />
        </FieldGroup>
        <FieldGroup label="Phone number">
          <TextInput value={user.phone} />
        </FieldGroup>
      </div>

      <SectionDivider />

      {/* Read-only info */}
      <div>
        <Eyebrow tone="muted" mark="&sect;">Account information</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Member since
            </span>
            <OrdinalDate date={user.memberSince} variant="short" className="text-sm font-sans text-ink" />
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Last active
            </span>
            <OrdinalDate date={user.lastActiveAt} variant="short" className="text-sm font-sans text-ink" />
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Roles
            </span>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center px-2 py-[2px] border border-rule text-[10px] font-sans font-medium text-ink-soft bg-paper"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Position
            </span>
            {user.positions.map((p, i) => (
              <div key={i} className="text-sm font-sans text-ink">
                {p.title} <span className="font-serif italic text-ink-muted">{p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button size="sm">Save changes</Button>
        <Button size="sm" variant="ghost">Cancel</Button>
      </div>
    </div>
  );
}

// ─── Security section ───────────────────────────────────────────────

function SecuritySection() {
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Security</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      {/* Change password */}
      <div>
        <Eyebrow tone="muted" mark="&sect;">Change password</Eyebrow>
        <div className="mt-4 max-w-md space-y-3">
          <FieldGroup label="Current password">
            <PasswordInput placeholder="Enter current password" />
          </FieldGroup>
          <FieldGroup label="New password">
            <PasswordInput placeholder="Enter new password" />
          </FieldGroup>
          <FieldGroup label="Confirm new password">
            <PasswordInput placeholder="Confirm new password" />
          </FieldGroup>
          <div className="pt-1">
            <Button size="sm">Update password</Button>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* Two-factor */}
      <div>
        <Eyebrow tone="muted" mark="&sect;">Two-factor authentication</Eyebrow>
        <div className="mt-4 flex items-start gap-4">
          <Toggle checked={twoFaEnabled} onChange={setTwoFaEnabled} />
          <div>
            <p className="text-sm font-sans text-ink">
              {twoFaEnabled
                ? 'Two-factor authentication is enabled'
                : 'Two-factor authentication is disabled'}
            </p>
            <p className="text-[11px] font-serif italic text-ink-muted mt-0.5">
              {twoFaEnabled
                ? 'Your account is protected with an authenticator app.'
                : 'Add an extra layer of security to your account.'}
            </p>
            {twoFaEnabled && (
              <button
                type="button"
                className="mt-2 text-[10px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:text-signal/80 transition-colors"
              >
                Disable 2FA
              </button>
            )}
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* Active sessions */}
      <div>
        <div className="flex items-center justify-between">
          <Eyebrow tone="muted" mark="&sect;">Active sessions</Eyebrow>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:text-signal/80 transition-colors"
          >
            <LogOut className="w-3 h-3" strokeWidth={1.5} />
            Sign out everywhere
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {ACTIVE_SESSIONS.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ActiveSession }) {
  const DeviceIcon = session.device.includes('iPhone')
    ? Smartphone
    : session.device.includes('iPad')
      ? Smartphone
      : Monitor;

  return (
    <div className="flex items-center justify-between px-4 py-3 border border-rule bg-paper">
      <div className="flex items-center gap-3">
        <DeviceIcon className="w-4 h-4 text-ink-muted flex-none" strokeWidth={1.5} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-sans text-ink">{session.device}</span>
            <span className="text-[11px] font-mono text-ink-muted">{session.browser}</span>
            {session.isCurrent && (
              <span className="inline-flex items-center px-1.5 py-[1px] bg-filed/10 border border-filed/30 text-[9px] uppercase tracking-eyebrow font-sans font-semibold text-filed">
                Current
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Globe className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
            <span className="text-[11px] font-mono text-ink-muted">
              {session.ip} &middot; {session.location}
            </span>
            <span className="text-[11px] text-ink-muted">&middot;</span>
            <OrdinalDate date={session.lastActiveAt} variant="short" className="text-[11px] text-ink-muted" />
          </div>
        </div>
      </div>
      {!session.isCurrent && (
        <button
          type="button"
          className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:text-signal/80 transition-colors flex-none"
        >
          Revoke
        </button>
      )}
    </div>
  );
}

// ─── Notifications section ──────────────────────────────────────────

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationCategory[]>(NOTIFICATION_CATEGORIES);

  const togglePref = (key: string, channel: 'email' | 'inApp') => {
    setPrefs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [channel]: !c[channel] } : c)),
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Notifications</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Choose how and when you want to be notified.
        </p>
      </div>

      {/* Channel legend */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
          <span className="w-2 h-2 bg-authority" />
          Email
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
          <span className="w-2 h-2 bg-filed" />
          In-app
        </div>
      </div>

      {/* Categories */}
      <div className="border border-rule divide-y divide-rule">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_60px_60px] px-4 py-2 bg-paper-sunken">
          <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
            Category
          </span>
          <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted text-center">
            Email
          </span>
          <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted text-center">
            In-app
          </span>
        </div>
        {prefs.map((cat) => (
          <div
            key={cat.key}
            className="grid grid-cols-[1fr_60px_60px] items-center px-4 py-3"
          >
            <div>
              <span className="text-sm font-sans text-ink">{cat.label}</span>
              <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
                {cat.description}
              </span>
            </div>
            <div className="flex justify-center">
              <Toggle
                checked={cat.email}
                onChange={() => togglePref(cat.key, 'email')}
              />
            </div>
            <div className="flex justify-center">
              <Toggle
                checked={cat.inApp}
                onChange={() => togglePref(cat.key, 'inApp')}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button size="sm">Save preferences</Button>
        <Button size="sm" variant="ghost">Reset to defaults</Button>
      </div>
    </div>
  );
}

// ─── Appearance section ─────────────────────────────────────────────

function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [density, setDensity] = useState<Density>('comfortable');

  const themes: { value: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
    { value: 'light', label: 'Light', icon: Sun, desc: 'Warm parchment tones' },
    { value: 'dark', label: 'Dark', icon: Moon, desc: 'Graphite & bone' },
    { value: 'system', label: 'System', icon: Laptop, desc: 'Match OS preference' },
  ];

  const densities: { value: Density; label: string; icon: typeof LayoutGrid; desc: string }[] = [
    { value: 'comfortable', label: 'Comfortable', icon: LayoutGrid, desc: 'More whitespace, larger rows' },
    { value: 'compact', label: 'Compact', icon: LayoutList, desc: 'Tighter spacing, more data' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Appearance</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Customize how the application looks and feels.
        </p>
      </div>

      {/* Theme */}
      <div>
        <Eyebrow tone="muted" mark="&sect;">Theme</Eyebrow>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {themes.map((t) => {
            const Icon = t.icon;
            const selected = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={`flex flex-col items-center gap-3 px-4 py-5 border transition-colors ${
                  selected
                    ? 'border-authority bg-authority/5'
                    : 'border-rule bg-paper hover:border-ink-muted'
                }`}
              >
                {/* Preview swatch */}
                <div
                  className={`w-full h-16 border flex items-center justify-center ${
                    t.value === 'dark'
                      ? 'bg-[#1a1c1f] border-[#333]'
                      : t.value === 'light'
                        ? 'bg-[#F6F3EC] border-[#E1DBCE]'
                        : 'bg-gradient-to-r from-[#F6F3EC] to-[#1a1c1f] border-rule'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      t.value === 'dark' ? 'text-[#E8E1D3]' : 'text-[#1A1D21]'
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-center">
                  <span className={`block text-sm font-sans ${selected ? 'text-authority font-medium' : 'text-ink'}`}>
                    {t.label}
                  </span>
                  <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
                    {t.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <SectionDivider />

      {/* Density */}
      <div>
        <Eyebrow tone="muted" mark="&sect;">Table density</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
          {densities.map((d) => {
            const Icon = d.icon;
            const selected = density === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDensity(d.value)}
                className={`flex items-center gap-3 px-4 py-3 border transition-colors text-left ${
                  selected
                    ? 'border-authority bg-authority/5'
                    : 'border-rule bg-paper hover:border-ink-muted'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-none ${selected ? 'text-authority' : 'text-ink-muted'}`}
                  strokeWidth={1.5}
                />
                <div>
                  <span className={`block text-sm font-sans ${selected ? 'text-authority font-medium' : 'text-ink'}`}>
                    {d.label}
                  </span>
                  <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
                    {d.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Activity log section ───────────────────────────────────────────

const ACTIVITY_COLUMNS: DataTableColumn<ActivityEntry>[] = [
  {
    key: 'action',
    header: 'Action',
    width: '160px',
    cell: (e) => (
      <span className="text-sm font-sans font-medium text-ink">{e.action}</span>
    ),
  },
  {
    key: 'entity',
    header: 'Entity',
    cell: (e) => (
      <span className="text-sm font-sans text-ink">{e.entity}</span>
    ),
  },
  {
    key: 'detail',
    header: 'Detail',
    cell: (e) => (
      <span className="text-[11px] font-serif italic text-ink-muted">{e.detail}</span>
    ),
  },
  {
    key: 'ip',
    header: 'IP address',
    width: '130px',
    cell: (e) => (
      <span className="font-mono text-[11px] text-ink-muted tabular-nums">{e.ip}</span>
    ),
  },
  {
    key: 'timestamp',
    header: 'When',
    width: '120px',
    cell: (e) => (
      <OrdinalDate date={e.timestamp} variant="short" className="text-[11px]" />
    ),
  },
];

function ActivityLogSection() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ACTIVITY_LOG;
    return ACTIVITY_LOG.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.entity.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Activity log</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Your recent actions and login history.
        </p>
      </div>

      <DataGridShell
        columns={ACTIVITY_COLUMNS}
        rows={filtered}
        getRowKey={(e) => e.id}
        totalRows={ACTIVITY_LOG.length}
        activeFilters={[]}
        onClearFilters={() => {}}
        filters={
          <label className="flex items-center gap-2 min-w-[200px] max-w-xs flex-1 border-b border-rule focus-within:border-ink transition-colors pb-1">
            <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
            />
          </label>
        }
      />
    </div>
  );
}

// ─── Section content map ────────────────────────────────────────────

const SECTION_CONTENT: Record<SettingsSection, () => ReactElement> = {
  profile: ProfileSection,
  security: SecuritySection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  activity: ActivityLogSection,
};

// ─── Page ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('profile');

  const Content = SECTION_CONTENT[activeSection];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="dashboard" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────── */}
        <header className="mb-8">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
            <span>Account</span>
            <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
            <span className="text-ink">Settings</span>
          </div>
          <h1 className="font-serif text-4xl text-ink leading-none mt-1">Settings</h1>
          <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
            Manage your account, security, and preferences.
          </p>
        </header>

        {/* ─── Split layout: sidebar + content ──────────────────── */}
        <div className="flex gap-0 border border-rule bg-paper-raised">
          {/* Left nav */}
          <nav className="w-[220px] flex-none border-r border-rule bg-paper">
            <div className="py-2">
              {SETTINGS_SECTIONS.map((s) => {
                const Icon = SECTION_ICONS[s.key];
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveSection(s.key)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-paper-raised text-ink border-r-2 border-authority'
                        : 'text-ink-soft hover:text-ink hover:bg-paper-raised/50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-none ${isActive ? 'text-authority' : 'text-ink-muted'}`}
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-sans">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right content */}
          <div className="flex-1 min-w-0 px-10 py-8">
            <Content />
          </div>
        </div>
      </main>
    </div>
  );
}
