// ─── Types ──────────────────────────────────────────────────────────

export type AdminSettingsSection =
  | 'organization'
  | 'localization'
  | 'preferences';

export interface SelectOption {
  value: string;
  label: string;
}

export interface AdminSettingField {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'select' | 'logo';
  value: string;
  options?: SelectOption[];
}

export interface AdminSettingsGroup {
  key: AdminSettingsSection;
  label: string;
  description: string;
  fields: AdminSettingField[];
}

// ─── Options ────────────────────────────────────────────────────────

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee (₹)' },
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
  { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
];

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { value: 'America/New_York', label: 'America/New_York (EST, UTC−5)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST, UTC−6)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST, UTC−8)' },
  { value: 'Europe/London', label: 'Europe/London (GMT, UTC+0)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10)' },
];

const DATE_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY — 17/04/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 04/17/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2026-04-17' },
  { value: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY — 17-Apr-2026' },
  { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY — Apr 17, 2026' },
];

const TIME_FORMAT_OPTIONS: SelectOption[] = [
  { value: '12h', label: '12-hour — 2:30 PM' },
  { value: '24h', label: '24-hour — 14:30' },
];

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिन्दी)' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'ja', label: 'Japanese (日本語)' },
  { value: 'ar', label: 'Arabic (العربية)' },
  { value: 'zh', label: 'Chinese (中文)' },
];

const NUMBER_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'en-IN', label: '12,34,567.89 — Indian' },
  { value: 'en-US', label: '1,234,567.89 — US/UK' },
  { value: 'de-DE', label: '1.234.567,89 — European' },
  { value: 'fr-CH', label: "1'234'567.89 — Swiss" },
];

const WEEK_START_OPTIONS: SelectOption[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'saturday', label: 'Saturday' },
];

const FISCAL_YEAR_OPTIONS: SelectOption[] = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: '10', label: '10 rows' },
  { value: '25', label: '25 rows' },
  { value: '50', label: '50 rows' },
  { value: '100', label: '100 rows' },
];

// ─── Mock data ──────────────────────────────────────────────────────

export const ADMIN_SETTINGS_SECTIONS: { key: AdminSettingsSection; label: string }[] = [
  { key: 'organization', label: 'Organization' },
  { key: 'localization', label: 'Localization' },
  { key: 'preferences', label: 'Preferences' },
];

export const ADMIN_SETTINGS_GROUPS: AdminSettingsGroup[] = [
  {
    key: 'organization',
    label: 'Organization',
    description: 'Your company identity used across the platform — navigation, email templates, and generated documents.',
    fields: [
      {
        key: 'companyName',
        label: 'Company name',
        description: 'Displayed in the navigation bar, email headers, and PDF exports.',
        type: 'text',
        value: 'Goel & Associates',
      },
      {
        key: 'companyLogo',
        label: 'Company logo',
        description: 'Used in the sidebar, email templates, and generated PDF documents. Recommended size: 200 × 48px.',
        type: 'logo',
        value: '',
      },
    ],
  },
  {
    key: 'localization',
    label: 'Localization',
    description: 'Regional defaults for how dates, times, numbers, and currency are displayed across the platform.',
    fields: [
      {
        key: 'defaultCurrency',
        label: 'Default currency',
        description: 'The default currency for all monetary fields. Individual records may override this.',
        type: 'select',
        value: 'INR',
        options: CURRENCY_OPTIONS,
      },
      {
        key: 'defaultTimezone',
        label: 'Default timezone',
        description: 'Used for displaying times, scheduling, and "today" comparisons. Users can override in their profile.',
        type: 'select',
        value: 'Asia/Kolkata',
        options: TIMEZONE_OPTIONS,
      },
      {
        key: 'dateFormat',
        label: 'Date format',
        description: 'How calendar dates are displayed throughout the platform.',
        type: 'select',
        value: 'DD/MM/YYYY',
        options: DATE_FORMAT_OPTIONS,
      },
      {
        key: 'timeFormat',
        label: 'Time format',
        description: 'Clock format for displaying times.',
        type: 'select',
        value: '12h',
        options: TIME_FORMAT_OPTIONS,
      },
      {
        key: 'numberFormat',
        label: 'Number format',
        description: 'How numbers are grouped and separated in tables and reports.',
        type: 'select',
        value: 'en-IN',
        options: NUMBER_FORMAT_OPTIONS,
      },
      {
        key: 'defaultLanguage',
        label: 'Default language',
        description: 'The platform language for all users. Individual users can override this in their profile.',
        type: 'select',
        value: 'en',
        options: LANGUAGE_OPTIONS,
      },
      {
        key: 'weekStartDay',
        label: 'Week starts on',
        description: 'Affects calendars, date pickers, and weekly reports.',
        type: 'select',
        value: 'monday',
        options: WEEK_START_OPTIONS,
      },
    ],
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description: 'System-wide defaults that affect data display and reporting across the platform.',
    fields: [
      {
        key: 'fiscalYearStart',
        label: 'Fiscal year starts in',
        description: 'The month your fiscal year begins. Used in financial reports and period grouping.',
        type: 'select',
        value: '4',
        options: FISCAL_YEAR_OPTIONS,
      },
      {
        key: 'defaultPageSize',
        label: 'Default page size',
        description: 'How many rows are shown per page in tables by default. Users can change this per-table.',
        type: 'select',
        value: '25',
        options: PAGE_SIZE_OPTIONS,
      },
    ],
  },
];
