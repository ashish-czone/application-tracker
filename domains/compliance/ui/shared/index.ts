// Compliance-specific composite widgets. Built on top of @packages/ui/kit
// primitives. Know the vocabulary of this domain — laws, filings, clients,
// handlers, periods.

export { LawCard, type LawCardProps } from './LawCard';
export { FilingTaskCard, type FilingTaskCardProps } from './FilingTaskCard';
export { ComplianceCalendar, type ComplianceCalendarProps } from './ComplianceCalendar';
export { FilingTimeline, type FilingTimelineProps } from './FilingTimeline';
export {
  ClientLawMatrix,
  type ClientLawMatrixProps,
  type MatrixCellState,
} from './ClientLawMatrix';
export {
  HandlerWorkloadBar,
  HandlerWorkloadList,
  type HandlerWorkloadBarProps,
  type HandlerWorkloadListProps,
  type HandlerWorkload,
} from './HandlerWorkloadBar';
export { BulkFilingDrawer, type BulkFilingDrawerProps } from './BulkFilingDrawer';

export {
  DateRangePopover,
  type DateRangePopoverProps,
  type DateRangeValue,
} from './components/DateRangePopover';

export type { Law, Client, Handler, Filing, LawCode } from './types';
