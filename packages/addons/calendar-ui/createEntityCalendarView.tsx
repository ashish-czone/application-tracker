import { useMemo, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { useEntityConfig, useEntityHooks } from '@packages/entity-engine-ui';
import { EventCalendar } from './components/EventCalendar';
import type { CalendarEvent, CalendarView } from './types';

export interface EntityCalendarViewConfig {
  /** Field key on the entity record to use as the event start date. Required. */
  dateField: string;
  /** Field key to use as the event title. Defaults to the entity's label field. */
  titleField?: string;
  /** FullCalendar view to open on mount. Defaults to 'dayGridMonth'. */
  initialView?: CalendarView;
  /** Fetch cap. Calendar views are not paginated — records without a date are filtered client-side. Defaults to 500. */
  fetchLimit?: number;
}

function resolveLabelFieldKey(nameField: string | string[]): string {
  return Array.isArray(nameField) ? nameField[0] : nameField;
}

function formatRecordLabel(record: Record<string, unknown>, nameField: string | string[]): string {
  if (Array.isArray(nameField)) {
    return nameField.map((k) => record[k]).filter(Boolean).join(' ').trim() || '(untitled)';
  }
  const value = record[nameField];
  return typeof value === 'string' && value.length > 0 ? value : '(untitled)';
}

/**
 * Build a ListViewPlugin-compatible component that renders entity records
 * on a FullCalendar-backed calendar.
 *
 * Usage:
 * ```tsx
 * const listViews = [
 *   {
 *     key: 'calendar',
 *     label: 'Calendar',
 *     icon: CalendarIcon,
 *     order: 300,
 *     component: createEntityCalendarView({ dateField: 'dueDate' }),
 *   },
 * ];
 * ```
 */
export function createEntityCalendarView(
  config: EntityCalendarViewConfig,
): ComponentType<{ entityType: string }> {
  const { dateField, titleField, initialView = 'dayGridMonth', fetchLimit = 500 } = config;

  return function EntityCalendarView({ entityType }: { entityType: string }) {
    const navigate = useNavigate();
    const entity = useEntityConfig(entityType);
    const { useList } = useEntityHooks(entityType);
    const { data, isLoading } = useList({ page: 1, limit: fetchLimit });

    const events = useMemo<CalendarEvent[]>(() => {
      const records = (data?.data ?? []) as Record<string, unknown>[];
      const titleKey = titleField ?? resolveLabelFieldKey(entity.ui.nameField);
      return records
        .filter((r) => r[dateField] != null && r[dateField] !== '')
        .map((r) => ({
          id: String(r.id),
          title: titleField
            ? String(r[titleField] ?? '(untitled)')
            : formatRecordLabel(r, entity.ui.nameField),
          start: r[dateField] as string,
          allDay: true,
          extendedProps: { record: r, titleKey },
        }));
    }, [data, entity.ui.nameField]);

    if (isLoading) {
      return <div className="p-8 text-center text-sm text-muted-foreground">Loading calendar…</div>;
    }

    return (
      <EventCalendar
        events={events}
        initialView={initialView}
        onEventClick={(id) => navigate(`/${entity.slug}/${id}`)}
      />
    );
  };
}
