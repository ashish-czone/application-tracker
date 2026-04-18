import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSlidingHighlight } from '@packages/ui';

export interface ViewModeOption<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
}

export interface ViewModeSwitcherProps<T extends string> {
  modes: ViewModeOption<T>[];
  value: T;
  onChange: (next: T) => void;
}

export function ViewModeSwitcher<T extends string>({
  modes,
  value,
  onChange,
}: ViewModeSwitcherProps<T>) {
  const highlight = useSlidingHighlight<T>(value);

  return (
    <div ref={highlight.containerRef} className="relative flex border border-rule">
      {highlight.rect && (
        <motion.div
          aria-hidden
          className="absolute top-0 bottom-0 bg-ink"
          initial={false}
          animate={{ left: highlight.rect.left, width: highlight.rect.width }}
          transition={highlight.transition}
        />
      )}
      {modes.map((m) => (
        <button
          key={m.key}
          ref={(el) => highlight.setItemRef(m.key, el)}
          type="button"
          onClick={() => onChange(m.key)}
          className={`relative z-10 flex items-center justify-center w-8 h-8 transition-colors ${
            value === m.key ? 'text-paper' : 'text-ink-muted hover:text-ink'
          }`}
          aria-label={m.label}
        >
          <m.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}
