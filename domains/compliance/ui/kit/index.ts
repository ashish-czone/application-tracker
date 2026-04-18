// Compliance-flavored kit — composed on top of @packages/ui primitives.
// These components encode compliance-specific domain concepts (jurisdictions,
// filing urgency, stamp marks) or opinionated editorial aesthetics (newspaper
// masthead, ordinal dates) and therefore live in the compliance domain, not
// in the generic core/ui package.

export { JurisdictionTag, type JurisdictionTagProps, type Jurisdiction } from './JurisdictionTag';
export { UrgencyBadge, type UrgencyBadgeProps, type Urgency } from './UrgencyBadge';
export { StampMark, type StampMarkProps, type StampKind } from './StampMark';
export { OrdinalDate, type OrdinalDateProps } from './OrdinalDate';
export { DueDateBlock, type DueDateBlockProps } from './DueDateBlock';
export { PageMasthead, type PageMastheadProps } from './PageMasthead';

// Layout scaffolding — newspaper-themed panels, section wrappers and app chrome.
export { Panel, type PanelProps } from './Panel';
export { PanelHeading, type PanelHeadingProps } from './PanelHeading';
export { PageSection, type PageSectionProps } from './PageSection';
export {
  ConsoleHeaderBar,
  type ConsoleHeaderBarProps,
  type ConsoleHeaderBarUser,
  type ConsoleHeaderBarNavItem,
} from './ConsoleHeaderBar';
