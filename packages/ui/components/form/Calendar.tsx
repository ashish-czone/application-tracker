import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col sm:flex-row gap-4',
        month_caption: 'flex justify-center items-center h-7',
        caption_label: 'text-sm font-medium',
        nav: 'absolute top-0 flex w-full justify-between z-10',
        button_previous: cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors',
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        ),
        button_next: cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors',
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: cn(
          'relative p-0 text-center text-sm',
          'focus-within:relative focus-within:z-20',
          '[&:has([aria-selected])]:bg-accent',
          '[&:has([aria-selected].day-outside)]:bg-accent/50',
          '[&:has([aria-selected].day-range-end)]:rounded-r-md',
        ),
        day_button: cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors',
          'h-9 w-9 p-0 font-normal',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'aria-selected:opacity-100',
        ),
        range_end: 'day-range-end',
        selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md',
        today: 'bg-accent text-accent-foreground rounded-md',
        outside: 'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
