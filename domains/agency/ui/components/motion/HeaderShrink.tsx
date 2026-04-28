'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface HeaderShrinkProps {
  children: ReactNode;
  /** Scroll offset (px) past which the shrunk state engages. */
  threshold?: number;
  /** Class applied at all times. */
  className?: string;
  /** Class applied only when the page is at the top. */
  topClassName?: string;
  /** Class applied once the user has scrolled past `threshold`. */
  scrolledClassName?: string;
}

/**
 * Wraps a header element and toggles classes based on scroll position.
 * Used by the customer SiteHeader so it can swap padding + add a
 * blurred backdrop once the page scrolls.
 *
 * No motion library involvement on purpose — class transitions via
 * Tailwind keep the wrapper SSR-friendly and respect the user's
 * reduced-motion preference automatically (no JS-driven tween).
 */
export function HeaderShrink({
  children,
  threshold = 16,
  className,
  topClassName,
  scrolledClassName,
}: HeaderShrinkProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  const composed = [className, scrolled ? scrolledClassName : topClassName]
    .filter(Boolean)
    .join(' ');

  return <div className={composed}>{children}</div>;
}
