// Compliance-flavored components — composed on top of @packages/ui primitives.
// These components encode compliance-specific domain concepts (jurisdictions,
// filing urgency, stamp marks) or opinionated editorial aesthetics (newspaper
// masthead, ordinal dates) and therefore live in the compliance domain, not
// in the generic core/ui package.

// Avatars — brand-colored identity tiles.
export {
  ColoredInitialsAvatar,
  type ColoredInitialsAvatarProps,
  type ColoredInitialsAvatarSize,
} from './avatars/ColoredInitialsAvatar';

// Form — field-level chrome for drawers and settings panels.
export { FieldLabel, type FieldLabelProps } from './form/FieldLabel';

// Badges — compliance status + taxonomy markers.
export { Pill, type PillProps } from './badges/Pill';
export {
  JurisdictionTag,
  type JurisdictionTagProps,
  type Jurisdiction,
  type JurisdictionTagVariant,
} from './badges/JurisdictionTag';
export { UrgencyBadge, type UrgencyBadgeProps, type Urgency } from './badges/UrgencyBadge';
export { StampMark, type StampMarkProps, type StampKind } from './badges/StampMark';
export { HealthBar, type HealthBarProps } from './badges/HealthBar';
export { HandlerPill, type HandlerPillProps } from './badges/HandlerPill';
export {
  InactiveStateBanner,
  type InactiveStateBannerProps,
  type InactiveKind,
} from './badges/InactiveStateBanner';
export {
  InactiveSourceMarker,
  type InactiveSourceMarkerProps,
} from './badges/InactiveSourceMarker';

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
