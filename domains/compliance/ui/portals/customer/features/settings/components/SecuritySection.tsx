import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button, Eyebrow } from '@packages/ui';
import { ACTIVE_SESSIONS } from '../data/settingsMock';
import { FieldGroup, PasswordInput, Toggle, SectionDivider } from './settingsFormPrimitives';
import { SessionCard } from './SessionCard';

export function SecuritySection() {
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Security</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      <div>
        <Eyebrow tone="muted" mark="&sect;">
          Change password
        </Eyebrow>
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

      <div>
        <Eyebrow tone="muted" mark="&sect;">
          Two-factor authentication
        </Eyebrow>
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

      <div>
        <div className="flex items-center justify-between">
          <Eyebrow tone="muted" mark="&sect;">
            Active sessions
          </Eyebrow>
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
