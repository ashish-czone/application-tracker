export interface CalendarEvent {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  color?: string;
  textColor?: string;
  borderColor?: string;
  /** Arbitrary data attached to the event, available in callbacks */
  extendedProps?: Record<string, unknown>;
}

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
