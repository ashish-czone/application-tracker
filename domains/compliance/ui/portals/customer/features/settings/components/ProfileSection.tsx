import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { Button, Eyebrow } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { useAuth } from '@packages/auth-ui';
import type { User } from '@packages/users-ui';
import { OrdinalDate, ColoredInitialsAvatar } from '../../../../../components';
import { FieldGroup, TextInput, SectionDivider } from './settingsFormPrimitives';

const AVATAR_PALETTE = [
  'hsl(218 56% 24%)',
  'hsl(140 31% 33%)',
  'hsl(19 75% 44%)',
  'hsl(42 62% 45%)',
  'hsl(218 40% 40%)',
  'hsl(215 25% 35%)',
];

function hashToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

function initialsFor(first: string, last: string): string {
  const f = first?.[0] ?? '';
  const l = last?.[0] ?? '';
  return `${f}${l}`.toUpperCase() || '—';
}

function colorFor(seed: string): string {
  return AVATAR_PALETTE[hashToIndex(seed || 'user', AVATAR_PALETTE.length)];
}

export function ProfileSection() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const apiFn = usePlatformAPI();

  const userId = authUser?.userId ?? null;
  const profileQuery = useQuery<User>({
    queryKey: ['users', 'detail', userId],
    queryFn: () => apiFn.get<User>(`/users/${userId}`),
    enabled: !!userId,
  });

  const profile = profileQuery.data;
  const initials = useMemo(
    () => (profile ? initialsFor(profile.firstName, profile.lastName) : '—'),
    [profile],
  );
  const color = useMemo(() => colorFor(profile?.id ?? ''), [profile]);

  if (authLoading || profileQuery.isLoading) {
    return (
      <p className="font-mono text-[11px] tracking-tabular text-ink-muted">Loading profile…</p>
    );
  }
  if (!profile) {
    return (
      <p className="font-serif italic text-ink-soft text-sm">
        Could not load profile. Please refresh.
      </p>
    );
  }

  const positions = (profile.positions ?? []) as Array<{
    unitName: string | null;
    positionName: string | null;
  }>;
  const primaryPosition = positions[0];
  const roles = (profile.roles ?? []) as Array<{ name: string }>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Profile</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Your personal information and account details.
        </p>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative group">
          <ColoredInitialsAvatar initials={initials} color={color} size="3xl" />
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/40 transition-colors"
            disabled
          >
            <Camera
              className="w-4 h-4 text-paper-raised opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
            />
          </button>
        </div>
        <div>
          <p className="text-sm font-sans text-ink">
            {profile.firstName} {profile.lastName}
          </p>
          {primaryPosition && (
            <p className="text-[11px] font-serif italic text-ink-muted mt-0.5">
              {primaryPosition.positionName ?? 'Member'}
              {primaryPosition.unitName ? `, ${primaryPosition.unitName}` : ''}
            </p>
          )}
        </div>
      </div>

      <SectionDivider />

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="First name">
          <TextInput value={profile.firstName ?? ''} readOnly />
        </FieldGroup>
        <FieldGroup label="Last name">
          <TextInput value={profile.lastName ?? ''} readOnly />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Email address">
          <TextInput value={profile.email ?? ''} readOnly />
        </FieldGroup>
        <FieldGroup label="Phone number">
          <TextInput value={profile.phone ?? ''} readOnly />
        </FieldGroup>
      </div>

      <SectionDivider />

      <div>
        <Eyebrow tone="muted" mark="&sect;">
          Account information
        </Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Member since
            </span>
            {profile.createdAt ? (
              <OrdinalDate
                date={profile.createdAt}
                variant="short"
                className="text-sm font-sans text-ink"
              />
            ) : (
              <span className="text-sm font-serif italic text-ink-muted">—</span>
            )}
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Last login
            </span>
            {profile.lastLoginAt ? (
              <OrdinalDate
                date={profile.lastLoginAt}
                variant="short"
                className="text-sm font-sans text-ink"
              />
            ) : (
              <span className="text-sm font-serif italic text-ink-muted">—</span>
            )}
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Roles
            </span>
            <div className="flex flex-wrap gap-1.5">
              {roles.length === 0 ? (
                <span className="text-[11px] font-serif italic text-ink-muted">No roles assigned</span>
              ) : (
                roles.map((r) => (
                  <span
                    key={r.name}
                    className="inline-flex items-center px-2 py-[2px] border border-rule text-[10px] font-sans font-medium text-ink-soft bg-paper"
                  >
                    {r.name}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Position
            </span>
            {positions.length === 0 ? (
              <span className="text-[11px] font-serif italic text-ink-muted">No position</span>
            ) : (
              positions.map((p, i) => (
                <div key={i} className="text-sm font-sans text-ink">
                  {p.positionName ?? 'Member'}{' '}
                  {p.unitName ? (
                    <span className="font-serif italic text-ink-muted">{p.unitName}</span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button size="sm" disabled>
          Save changes
        </Button>
        <p className="text-[11px] font-serif italic text-ink-muted">
          Profile editing coming soon.
        </p>
      </div>
    </div>
  );
}
