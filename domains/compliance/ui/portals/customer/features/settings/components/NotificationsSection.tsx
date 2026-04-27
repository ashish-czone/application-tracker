import { useState } from 'react';
import { Button } from '@packages/ui';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '../placeholders';
import { Toggle } from './settingsFormPrimitives';

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationCategory[]>(NOTIFICATION_CATEGORIES);

  const togglePref = (key: string, channel: 'email' | 'inApp') => {
    setPrefs((prev) => prev.map((c) => (c.key === key ? { ...c, [channel]: !c[channel] } : c)));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Notifications</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Choose how and when you want to be notified.
        </p>
      </div>

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

      <div className="border border-rule divide-y divide-rule">
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
          <div key={cat.key} className="grid grid-cols-[1fr_60px_60px] items-center px-4 py-3">
            <div>
              <span className="text-sm font-sans text-ink">{cat.label}</span>
              <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
                {cat.description}
              </span>
            </div>
            <div className="flex justify-center">
              <Toggle checked={cat.email} onChange={() => togglePref(cat.key, 'email')} />
            </div>
            <div className="flex justify-center">
              <Toggle checked={cat.inApp} onChange={() => togglePref(cat.key, 'inApp')} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button size="sm">Save preferences</Button>
        <Button size="sm" variant="ghost">
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
