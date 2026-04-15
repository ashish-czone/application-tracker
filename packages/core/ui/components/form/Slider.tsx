import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Show tick marks at each step. */
  ticks?: boolean;
  /** Optional labels rendered below the track at min, midpoints, max. */
  legend?: React.ReactNode;
}

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, ticks, legend, min = 0, max = 100, step = 1, ...props }, ref) => {
  const tickCount = ticks ? Math.floor((max - min) / (step || 1)) + 1 : 0;
  const values = Array.isArray(props.value ?? props.defaultValue)
    ? ((props.value ?? props.defaultValue) as number[])
    : [Number(props.value ?? props.defaultValue ?? min)];

  return (
    <div className="w-full" data-slot="slider-root">
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        step={step}
        className={cn(
          'relative flex w-full touch-none select-none items-center py-3',
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-[2px] w-full grow overflow-visible rounded-none bg-border"
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            className="absolute h-full bg-primary"
          />
        </SliderPrimitive.Track>
        {ticks && tickCount > 0 && (
          <div
            aria-hidden
            data-slot="slider-ticks"
            className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between"
          >
            {Array.from({ length: tickCount }).map((_, i) => (
              <span
                key={i}
                className="block h-2 w-px bg-border"
              />
            ))}
          </div>
        )}
        {values.map((_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            data-slot="slider-thumb"
            className={cn(
              'block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm',
              'ring-offset-background transition-[transform,box-shadow]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              'hover:scale-110',
            )}
          />
        ))}
      </SliderPrimitive.Root>
      {legend && (
        <div
          data-slot="slider-legend"
          className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {legend}
        </div>
      )}
    </div>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
