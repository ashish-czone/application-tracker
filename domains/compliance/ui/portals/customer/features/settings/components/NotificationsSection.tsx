import { BellOff } from 'lucide-react';

export function NotificationsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Notifications</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Choose how and when you want to be notified.
        </p>
      </div>

      <div className="border border-rule bg-paper p-6 flex items-start gap-4">
        <BellOff className="w-5 h-5 text-ink-muted flex-none mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-sans text-ink">Coming soon</p>
          <p className="mt-1 text-[12px] font-serif italic text-ink-soft leading-relaxed">
            User-level notification preferences need a dedicated platform feature —
            the platform notifications package today manages templates, not per-user
            opt-in/opt-out by category and channel. The mock toggles that previously
            rendered here have been removed; this section will be wired once the
            preferences endpoint ships.
          </p>
        </div>
      </div>
    </div>
  );
}
