import { Module, type OnModuleInit } from '@nestjs/common';
import {
  AppConfigService,
  type SettingsModuleDefinition,
} from '@packages/settings';

const generalDefinition: SettingsModuleDefinition = {
  label: 'Localization',
  defaults: {
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    numberFormat: 'en-IN',
    defaultLanguage: 'en',
    weekStartDay: 'monday',
  },
  metadata: {
    defaultCurrency: {
      label: 'Default currency',
      type: 'string',
      description: 'The default currency for all monetary fields. Individual records may override this.',
      options: [
        { value: 'INR', label: 'INR — Indian Rupee (₹)' },
        { value: 'USD', label: 'USD — US Dollar ($)' },
        { value: 'EUR', label: 'EUR — Euro (€)' },
        { value: 'GBP', label: 'GBP — British Pound (£)' },
        { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
        { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
        { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
        { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
        { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
      ],
    },
    defaultTimezone: {
      label: 'Default timezone',
      type: 'string',
      description: 'Used for displaying times, scheduling, and "today" comparisons. Users can override in their profile.',
      options: [
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
      ],
    },
    dateFormat: {
      label: 'Date format',
      type: 'string',
      description: 'How calendar dates are displayed throughout the platform.',
      options: [
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY — 17/04/2026' },
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY — 04/17/2026' },
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD — 2026-04-17' },
        { value: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY — 17-Apr-2026' },
        { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY — Apr 17, 2026' },
      ],
    },
    timeFormat: {
      label: 'Time format',
      type: 'string',
      description: 'Clock format for displaying times.',
      options: [
        { value: '12h', label: '12-hour — 2:30 PM' },
        { value: '24h', label: '24-hour — 14:30' },
      ],
    },
    numberFormat: {
      label: 'Number format',
      type: 'string',
      description: 'How numbers are grouped and separated in tables and reports.',
      options: [
        { value: 'en-IN', label: '12,34,567.89 — Indian' },
        { value: 'en-US', label: '1,234,567.89 — US/UK' },
        { value: 'de-DE', label: '1.234.567,89 — European' },
        { value: 'fr-CH', label: "1'234'567.89 — Swiss" },
      ],
    },
    defaultLanguage: {
      label: 'Default language',
      type: 'string',
      description: 'The platform language for all users. Individual users can override this in their profile.',
      options: [
        { value: 'en', label: 'English' },
        { value: 'hi', label: 'Hindi (हिन्दी)' },
        { value: 'es', label: 'Spanish (Español)' },
        { value: 'fr', label: 'French (Français)' },
        { value: 'de', label: 'German (Deutsch)' },
        { value: 'ja', label: 'Japanese (日本語)' },
        { value: 'ar', label: 'Arabic (العربية)' },
        { value: 'zh', label: 'Chinese (中文)' },
      ],
    },
    weekStartDay: {
      label: 'Week starts on',
      type: 'string',
      description: 'Affects calendars, date pickers, and weekly reports.',
      options: [
        { value: 'monday', label: 'Monday' },
        { value: 'sunday', label: 'Sunday' },
        { value: 'saturday', label: 'Saturday' },
      ],
    },
  },
};

const preferencesDefinition: SettingsModuleDefinition = {
  label: 'Preferences',
  defaults: {
    fiscalYearStart: '4',
    defaultPageSize: '25',
  },
  metadata: {
    fiscalYearStart: {
      label: 'Fiscal year starts in',
      type: 'string',
      description: 'The month your fiscal year begins. Used in financial reports and period grouping.',
      options: [
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
      ],
    },
    defaultPageSize: {
      label: 'Default page size',
      type: 'string',
      description: 'How many rows are shown per page in tables by default. Users can change this per-table.',
      options: [
        { value: '10', label: '10 rows' },
        { value: '25', label: '25 rows' },
        { value: '50', label: '50 rows' },
        { value: '100', label: '100 rows' },
      ],
    },
  },
};

export const APP_DEFAULTS_SETTINGS = {
  general: generalDefinition,
  preferences: preferencesDefinition,
} as const;

@Module({})
export class AppDefaultsModule implements OnModuleInit {
  constructor(private readonly appConfig: AppConfigService) {}

  onModuleInit() {
    this.appConfig.register('general', generalDefinition);
    this.appConfig.register('preferences', preferencesDefinition);
  }
}
