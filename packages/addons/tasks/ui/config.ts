import { CalendarDays } from 'lucide-react';
import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { createEntityCalendarView } from '@packages/calendar-ui';

export const TASKS_UI_CONFIG: EntityUIConfig = {
  entityType: 'tasks',
  listViews: [
    {
      key: 'calendar',
      label: 'Calendar',
      icon: CalendarDays,
      order: 300,
      component: createEntityCalendarView({ dateField: 'dueDate' }),
    },
  ],
};
