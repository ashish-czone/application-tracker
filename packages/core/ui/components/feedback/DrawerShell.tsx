import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export type DrawerShellWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type DrawerShellSide = 'right' | 'left';

export interface DrawerShellProps {
  /** Called when the backdrop is clicked. */
  onClose?: () => void;
  /** Panel max width. Default: `lg` (max-w-lg). */
  width?: DrawerShellWidth;
  /** Side the panel slides in from. Default: `right`. */
  side?: DrawerShellSide;
  /** When false, clicking the backdrop does nothing. Default: `true`. */
  closeOnBackdropClick?: boolean;
  /** Drawer contents — typically `<DrawerHeader/>` + body + footer. */
  children?: ReactNode;
  /** Extra className on the sliding panel. */
  className?: string;
}

const EASE_OUT_EXPO = [0.32, 0.72, 0, 1] as const;

const WIDTH_CLASS: Record<DrawerShellWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export function DrawerShell({
  onClose,
  width = 'lg',
  side = 'right',
  closeOnBackdropClick = true,
  children,
  className,
}: DrawerShellProps) {
  const isRight = side === 'right';
  const offscreenX = isRight ? '100%' : '-100%';

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex',
        isRight ? 'justify-end' : 'justify-start',
      )}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden
      />
      <motion.div
        initial={{ x: offscreenX }}
        animate={{ x: 0 }}
        exit={{ x: offscreenX }}
        transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
        className={cn(
          'relative w-full h-full bg-paper-raised flex flex-col border-rule',
          isRight ? 'border-l' : 'border-r',
          WIDTH_CLASS[width],
          className,
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
