import { Camera } from 'lucide-react';
import { Button, Eyebrow } from '@packages/ui';
import { OrdinalDate, ColoredInitialsAvatar } from '../../../../../components';
import { CURRENT_USER } from '../placeholders';
import { FieldGroup, TextInput, SectionDivider } from './settingsFormPrimitives';

export function ProfileSection() {
  const user = CURRENT_USER;
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
          <ColoredInitialsAvatar initials={user.initials} color={user.color} size="3xl" />
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/40 transition-colors"
          >
            <Camera
              className="w-4 h-4 text-paper-raised opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
            />
          </button>
        </div>
        <div>
          <p className="text-sm font-sans text-ink">
            {user.firstName} {user.lastName}
          </p>
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

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="First name">
          <TextInput value={user.firstName} />
        </FieldGroup>
        <FieldGroup label="Last name">
          <TextInput value={user.lastName} />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Email address">
          <TextInput value={user.email} readOnly />
        </FieldGroup>
        <FieldGroup label="Phone number">
          <TextInput value={user.phone} />
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
            <OrdinalDate
              date={user.memberSince}
              variant="short"
              className="text-sm font-sans text-ink"
            />
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
              Last active
            </span>
            <OrdinalDate
              date={user.lastActiveAt}
              variant="short"
              className="text-sm font-sans text-ink"
            />
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

      <div className="flex items-center gap-3 pt-2">
        <Button size="sm">Save changes</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}
