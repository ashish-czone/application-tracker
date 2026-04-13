import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CalendarDays } from 'lucide-react';
import { Button } from '@packages/ui';
import { EventCalendar, type CalendarEvent } from '@packages/calendar-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import '@packages/calendar-ui/styles.css';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'hsl(217, 91%, 60%)',
  completed: 'hsl(160, 84%, 39%)',
  cancelled: 'hsl(220, 9%, 46%)',
  'no-show': 'hsl(0, 84%, 60%)',
  rescheduled: 'hsl(38, 92%, 50%)',
};

const TYPE_COLORS: Record<string, string> = {
  phone: 'hsl(239, 84%, 67%)',
  video: 'hsl(217, 91%, 60%)',
  'on-site': 'hsl(38, 92%, 50%)',
  panel: 'hsl(258, 90%, 66%)',
  'take-home': 'hsl(173, 80%, 40%)',
  technical: 'hsl(330, 81%, 60%)',
  hr: 'hsl(160, 84%, 39%)',
};

const DEFAULT_EVENT_COLOR = 'hsl(220, 9%, 46%)';

export function InterviewsCalendarPage() {
  const navigate = useNavigate();
  const { apiFn } = useEntityEngine();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['interviews', 'calendar', dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '200',
        sort: 'interviewFrom',
        order: 'asc',
      });
      if (dateRange) {
        params.set('filters', JSON.stringify([
          { field: 'interviewFrom', operator: 'gte', value: dateRange.start.toISOString() },
          { field: 'interviewFrom', operator: 'lte', value: dateRange.end.toISOString() },
        ]));
      }
      return apiFn.get<{ data: Record<string, unknown>[] }>(`/interviews?${params}`);
    },
    enabled: !!dateRange,
  });

  const events = useMemo<CalendarEvent[]>(() => {
    if (!data?.data) return [];
    return data.data.map((interview) => {
      const status = (interview.status as string) ?? '';
      const type = (interview.interviewType as string) ?? '';
      const candidateLabel = (interview.candidateId__label as string) ?? '';
      const jobLabel = (interview.jobOpeningId__label as string) ?? '';
      const title = candidateLabel
        ? `${candidateLabel}${jobLabel ? ` — ${jobLabel}` : ''}`
        : (interview.interviewName as string) || 'Interview';

      return {
        id: interview.id as string,
        title,
        start: interview.interviewFrom as string,
        end: interview.interviewTo as string,
        color: STATUS_COLORS[status] ?? TYPE_COLORS[type] ?? DEFAULT_EVENT_COLOR,
        extendedProps: {
          interviewId: interview.id,
          status,
          type,
          candidateLabel,
          jobLabel,
        },
      };
    });
  }, [data]);

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/interviews/${eventId}`);
    },
    [navigate],
  );

  const handleDatesChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-10 w-10 text-destructive/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">Failed to load interviews</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Interview Calendar</h1>
        <p className="text-sm text-muted-foreground">View scheduled interviews across all job openings</p>
      </div>

      {isLoading && !data ? (
        <div className="h-[640px] animate-pulse rounded-lg bg-muted" />
      ) : !dateRange || events.length > 0 ? (
        <EventCalendar
          events={events}
          initialView="timeGridWeek"
          height={640}
          onEventClick={handleEventClick}
          onDatesChange={handleDatesChange}
        />
      ) : (
        <div>
          <EventCalendar
            events={events}
            initialView="timeGridWeek"
            height={640}
            onEventClick={handleEventClick}
            onDatesChange={handleDatesChange}
          />
          {events.length === 0 && (
            <div className="text-center py-8 -mt-64 relative z-10">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No interviews scheduled</p>
              <p className="text-sm text-muted-foreground mt-1">No interviews found for this date range.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
