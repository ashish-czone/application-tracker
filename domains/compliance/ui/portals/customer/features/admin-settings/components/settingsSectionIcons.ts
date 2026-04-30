import { Globe, SlidersHorizontal, Settings, type LucideIcon } from 'lucide-react';

export const SECTION_ICONS: Record<string, LucideIcon> = {
  general: Globe,
  preferences: SlidersHorizontal,
};

/** Fallback when a settings module slug isn't in SECTION_ICONS. */
export const DEFAULT_SECTION_ICON: LucideIcon = Settings;

/**
 * Per-module fallback descriptions rendered in the section sidebar / header.
 * The platform `SettingsGroup` shape doesn't carry a `description`; this map
 * lives at the consumer until/unless the platform exposes one. Unknown
 * modules render with an empty description.
 */
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  general:
    'Regional defaults for how dates, times, numbers, and currency are displayed across the platform.',
  preferences:
    'System-wide defaults that affect data display and reporting across the platform.',
};
