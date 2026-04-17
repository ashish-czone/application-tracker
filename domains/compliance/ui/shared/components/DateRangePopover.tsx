import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, Check } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@packages/ui';

export interface DateRangeValue {
  from: Date;
  to: Date;
}

type PresetKey = 'last-30' | 'last-3m' | 'last-6m' | 'this-quarter' | 'ytd' | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
  compute?: (today: Date) => DateRangeValue;
}

const PRESETS: Preset[] = [
  { key: 'last-30', label: 'Last 30 days', compute: (t) => ({ from: addDays(t, -29), to: t }) },
  { key: 'last-3m', label: 'Last 3 months', compute: (t) => ({ from: startOfMonth(subMonths(t, 2)), to: t }) },
  { key: 'last-6m', label: 'Last 6 months', compute: (t) => ({ from: startOfMonth(subMonths(t, 5)), to: t }) },
  {
    key: 'this-quarter',
    label: 'This quarter',
    compute: (t) => {
      const q = Math.floor(t.getMonth() / 3);
      const from = startOfMonth(new Date(t.getFullYear(), q * 3, 1));
      return { from, to: endOfMonth(addMonths(from, 2)) };
    },
  },
  { key: 'ytd', label: 'Year to date', compute: (t) => ({ from: startOfYear(t), to: t }) },
  { key: 'custom', label: 'Custom' },
];

function rangesEqual(a: DateRangeValue, b: DateRangeValue) {
  return (
    format(a.from, 'yyyy-MM-dd') === format(b.from, 'yyyy-MM-dd') &&
    format(a.to, 'yyyy-MM-dd') === format(b.to, 'yyyy-MM-dd')
  );
}

function matchPreset(value: DateRangeValue, today: Date): PresetKey {
  for (const p of PRESETS) {
    if (!p.compute) continue;
    if (rangesEqual(p.compute(today), value)) return p.key;
  }
  return 'custom';
}

function formatRange(value: DateRangeValue): string {
  const sameYear = value.from.getFullYear() === value.to.getFullYear();
  const fromFmt = sameYear ? 'MMM d' : 'MMM d, yyyy';
  return `${format(value.from, fromFmt)} – ${format(value.to, 'MMM d, yyyy')}`;
}

export interface DateRangePopoverProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  today?: Date;
  align?: 'start' | 'center' | 'end';
}

export function DateRangePopover({
  value,
  onChange,
  today = new Date(),
  align = 'end',
}: DateRangePopoverProps) {
  const [open, setOpen] = useState(false);
  const activePreset = useMemo(() => matchPreset(value, today), [value, today]);

  const selected: DateRange = { from: value.from, to: value.to };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;
    onChange({ from: range.from, to: range.to ?? range.from });
  };

  const applyPreset = (preset: Preset) => {
    if (!preset.compute) return;
    onChange(preset.compute(today));
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 border border-rule text-[11px] font-sans text-ink-soft hover:border-ink hover:text-ink transition-colors data-[state=open]:border-ink data-[state=open]:text-ink"
        >
          <CalendarDays className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
          <span className="tabular-nums">{formatRange(value)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="z-50 bg-paper-raised border border-rule shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex">
            <ul className="flex flex-col border-r border-rule py-2 min-w-[150px]">
              {PRESETS.map((p) => {
                const isActive = p.key === activePreset;
                const isCustom = p.key === 'custom';
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      disabled={isCustom && !isActive}
                      onClick={() => applyPreset(p)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-1.5 text-[11px] font-sans text-left transition-colors ${
                        isActive
                          ? 'text-ink font-medium bg-paper'
                          : 'text-ink-soft hover:text-ink hover:bg-paper'
                      } ${isCustom && !isActive ? 'cursor-default opacity-60' : ''}`}
                    >
                      <span>{p.label}</span>
                      {isActive && <Check className="w-3 h-3" strokeWidth={2} />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="p-1">
              <Calendar
                mode="range"
                selected={selected}
                onSelect={handleCalendarSelect}
                defaultMonth={subMonths(value.to, 1)}
                numberOfMonths={2}
                endMonth={endOfYear(today)}
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
