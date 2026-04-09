import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { EventCalendar, type CalendarEvent } from '@packages/calendar-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import '@packages/calendar-ui/styles.css';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  completed: '#10b981',
  cancelled: '#9ca3af',
  'no-show': '#ef4444',
  rescheduled: '#f59e0b',
};

const TYPE_COLORS: Record<string, string> = {
  phone: '#6366f1',
  video: '#3b82f6',
  'on-site': '#f59e0b',
  panel: '#8b5cf6',
  'take-home': '#14b8a6',
  technical: '#ec4899',
  hr: '#10b981',
};

export function InterviewsCalendarPage() {
  const navigate = useNavigate();
  const { apiFn } = useEntityEngine();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);

  const { data } = useQuery({
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
      const status = interview.status as string;
      const type = interview.interviewType as string;
      const candidateLabel = interview.candidateId__label as string;
      const jobLabel = interview.jobOpeningId__label as string;
      const title = candidateLabel
        ? `${candidateLabel}${jobLabel ? ` — ${jobLabel}` : ''}`
        : (interview.interviewName as string) || 'Interview';

      return {
        id: interview.id as string,
        title,
        start: interview.interviewFrom as string,
        end: interview.interviewTo as string,
        color: STATUS_COLORS[status] ?? TYPE_COLORS[type] ?? '#6b7280',
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Interview Calendar</h1>
        <p className="text-sm text-muted-foreground">View scheduled interviews across all job openings</p>
      </div>
      <EventCalendar
        events={events}
        initialView="timeGridWeek"
        height={640}
        onEventClick={handleEventClick}
        onDatesChange={handleDatesChange}
      />
    </div>
  );
}
