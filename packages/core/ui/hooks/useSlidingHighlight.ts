import { useRef, useState, useCallback, useEffect } from 'react';

export interface SlidingHighlightResult<T extends string> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  setItemRef: (key: T, el: HTMLElement | null) => void;
  rect: { left: number; width: number } | null;
  transition: { type: 'spring'; stiffness: number; damping: number; mass: number };
}

/**
 * Tracks the position of the active item within a container and returns
 * a rect that a `motion.div` can animate to — producing a sliding
 * highlight / underline effect.
 */
export function useSlidingHighlight<T extends string>(
  activeKey: T,
): SlidingHighlightResult<T> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<T, HTMLElement>>(new Map());
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);

  const setItemRef = useCallback((key: T, el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(key, el);
    } else {
      itemRefs.current.delete(key);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const item = itemRefs.current.get(activeKey);
    if (!container || !item) {
      setRect(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setRect({
      left: itemRect.left - containerRect.left,
      width: itemRect.width,
    });
  }, [activeKey]);

  const transition = { type: 'spring' as const, stiffness: 500, damping: 35, mass: 0.8 };

  return { containerRef, setItemRef, rect, transition };
}
