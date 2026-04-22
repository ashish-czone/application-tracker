import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerDashboardWidget,
  getRegisteredWidgets,
  getRegisteredWidget,
  clearRegisteredWidgets,
} from '../registry';
import type { DashboardWidget } from '../types';

function makeWidget(overrides: Partial<DashboardWidget> = {}): DashboardWidget {
  return {
    id: 'test.widget',
    title: 'Test widget',
    component: () => null,
    defaultSize: 'md',
    ...overrides,
  };
}

describe('dashboard widget registry', () => {
  beforeEach(() => {
    clearRegisteredWidgets();
  });

  it('registers a widget and retrieves it by id', () => {
    const widget = makeWidget({ id: 'tasks.my-tasks', title: 'My tasks' });
    registerDashboardWidget(widget);

    expect(getRegisteredWidget('tasks.my-tasks')).toBe(widget);
    expect(getRegisteredWidgets()).toHaveLength(1);
  });

  it('throws when registering a duplicate id', () => {
    registerDashboardWidget(makeWidget({ id: 'duplicate' }));

    expect(() => registerDashboardWidget(makeWidget({ id: 'duplicate' }))).toThrow(
      /already registered/,
    );
  });

  it('returns undefined for an unknown id', () => {
    expect(getRegisteredWidget('unknown.widget')).toBeUndefined();
  });

  it('returns registered widgets in insertion order', () => {
    registerDashboardWidget(makeWidget({ id: 'a.one' }));
    registerDashboardWidget(makeWidget({ id: 'b.two' }));
    registerDashboardWidget(makeWidget({ id: 'c.three' }));

    expect(getRegisteredWidgets().map((w) => w.id)).toEqual(['a.one', 'b.two', 'c.three']);
  });

  it('clearRegisteredWidgets removes everything', () => {
    registerDashboardWidget(makeWidget({ id: 'x' }));
    clearRegisteredWidgets();

    expect(getRegisteredWidgets()).toHaveLength(0);
  });

  it('preserves widget metadata (permission, category, size)', () => {
    const widget = makeWidget({
      id: 'notifications.recent',
      requiredPermission: 'notifications.read',
      category: 'Communication',
      defaultSize: 'sm',
    });
    registerDashboardWidget(widget);

    const registered = getRegisteredWidget('notifications.recent');
    expect(registered?.requiredPermission).toBe('notifications.read');
    expect(registered?.category).toBe('Communication');
    expect(registered?.defaultSize).toBe('sm');
  });
});
