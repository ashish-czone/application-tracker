import { ShieldAlert } from 'lucide-react';

export function SecuritySection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Security</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      <div className="border border-rule bg-paper p-6 flex items-start gap-4">
        <ShieldAlert
          className="w-5 h-5 text-ink-muted flex-none mt-0.5"
          strokeWidth={1.5}
        />
        <div>
          <p className="text-sm font-sans text-ink">Coming soon</p>
          <p className="mt-1 text-[12px] font-serif italic text-ink-soft leading-relaxed">
            Password change, two-factor authentication, and active session management
            need real platform support — session storage, TOTP enrolment, recovery
            codes — and will land in a dedicated security-hardening pass. The mock
            controls that previously rendered here have been removed; what shows up
            in this section will be wired to real auth endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}
