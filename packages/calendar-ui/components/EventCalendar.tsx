import { useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button, cn } from '@packages/ui';
import type { CalendarEvent, CalendarView } from '../types';

interface EventCalendarProps {
  events: CalendarEvent[];
  initialView?: CalendarView;
  height?: string | number;
  className?: string;
  /** Called when an event is clicked */
  onEventClick?: (eventId: string, extendedProps: Record<string, unknown>) => void;
  /** Called when a date/time slot is clicked */
  onDateClick?: (date: Date, allDay: boolean) => void;
  /** Called when the visible date range changes (for lazy-loading events) */
  onDatesChange?: (start: Date, end: Date) => void;
}

const VIEW_OPTIONS: { key: CalendarView; label: string }[] = [
  { key: 'timeGridDay', label: 'Day' },
  { key: 'timeGridWeek', label: 'Week' },
  { key: 'dayGridMonth', label: 'Month' },
];

export function EventCalendar({
  events,
  initialView = 'timeGridWeek',
  height = 'auto',
  className,
  onEventClick,
  onDateClick,
  onDatesChange,
}: EventCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState<CalendarView>(initialView);
  const [title, setTitle] = useState('');

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      onEventClick?.(info.event.id, info.event.extendedProps);
    },
    [onEventClick],
  );

  const handleDateClick = useCallback(
    (info: { date: Date; allDay: boolean }) => {
      onDateClick?.(info.date, info.allDay);
    },
    [onDateClick],
  );

  const handleDatesSet = useCallback(
    (info: DatesSetArg) => {
      setTitle(info.view.title);
      onDatesChange?.(info.start, info.end);
    },
    [onDatesChange],
  );

  const navigate = (action: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (action === 'prev') api.prev();
    else if (action === 'next') api.next();
    else api.today();
  };

  const changeView = (view: CalendarView) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(view);
    setCurrentView(view);
  };

  return (
    <div className={cn('event-calendar', className)}>
      {/* Custom toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('today')}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            Today
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold text-foreground ml-1">{title}</h2>
        </div>

        <div className="flex items-center rounded-md border border-input bg-background">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => changeView(opt.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md',
                currentView === opt.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* FullCalendar instance */}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        events={events}
        headerToolbar={false}
        height={height}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        datesSet={handleDatesSet}
        nowIndicator
        dayMaxEvents={3}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        allDaySlot={false}
        weekends
        editable={false}
        selectable={false}
        eventDisplay="block"
        dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
        slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
      />
    </div>
  );
}
