// Compliance-flavored components — composed on top of @packages/ui primitives.
// These components encode compliance-specific domain concepts (jurisdictions,
// filing urgency, stamp marks) or opinionated editorial aesthetics (newspaper
// masthead, ordinal dates) and therefore live in the compliance domain, not
// in the generic core/ui package.

// Badges — compliance status + taxonomy markers.
export { JurisdictionTag, type JurisdictionTagProps, type Jurisdiction } from './badges/JurisdictionTag';
export { UrgencyBadge, type UrgencyBadgeProps, type Urgency } from './badges/UrgencyBadge';
export { StampMark, type StampMarkProps, type StampKind } from './badges/StampMark';
export { HealthBar, type HealthBarProps } from './badges/HealthBar';
export { HandlerPill, type HandlerPillProps } from './badges/HandlerPill';

// Editorial — opinionated date formatting + due-date display.
export { OrdinalDate, type OrdinalDateProps } from './editorial/OrdinalDate';
export { DueDateBlock, type DueDateBlockProps } from './editorial/DueDateBlock';

// Layout — newspaper-themed panels, section wrappers and app chrome.
export { PageMasthead, type PageMastheadProps } from './layout/PageMasthead';
export { Panel, type PanelProps } from './layout/Panel';
export { PanelHeading, type PanelHeadingProps } from './layout/PanelHeading';
export { PageSection, type PageSectionProps } from './layout/PageSection';
export {
  ConsoleHeaderBar,
  type ConsoleHeaderBarProps,
  type ConsoleHeaderBarUser,
  type ConsoleHeaderBarNavItem,
} from './layout/ConsoleHeaderBar';
