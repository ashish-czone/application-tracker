import type { DashboardWidget } from './types';

const widgets = new Map<string, DashboardWidget>();

export function registerDashboardWidget(widget: DashboardWidget): void {
  if (widgets.has(widget.id)) {
    throw new Error(
      `Dashboard widget with id "${widget.id}" is already registered. Widget ids must be unique across all packages.`,
    );
  }
  widgets.set(widget.id, widget);
}

export function getRegisteredWidgets(): DashboardWidget[] {
  return Array.from(widgets.values());
}

export function getRegisteredWidget(id: string): DashboardWidget | undefined {
  return widgets.get(id);
}

export function clearRegisteredWidgets(): void {
  widgets.clear();
}
