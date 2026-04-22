import { describe, it, expect, vi } from 'vitest';
import type { AppConfigService } from '@packages/settings';
import { AppDefaultsModule, APP_DEFAULTS_SETTINGS } from '../modules/app-defaults.module';

function createMockAppConfig() {
  return {
    register: vi.fn(),
  } as unknown as AppConfigService;
}

describe('AppDefaultsModule', () => {
  it('registers the general and preferences modules on init', () => {
    const appConfig = createMockAppConfig();
    const module = new AppDefaultsModule(appConfig);

    module.onModuleInit();

    expect(appConfig.register).toHaveBeenCalledTimes(2);
    expect(appConfig.register).toHaveBeenCalledWith('general', APP_DEFAULTS_SETTINGS.general);
    expect(appConfig.register).toHaveBeenCalledWith('preferences', APP_DEFAULTS_SETTINGS.preferences);
  });

  describe('general module definition', () => {
    it('has the expected fields', () => {
      const keys = Object.keys(APP_DEFAULTS_SETTINGS.general.defaults);
      expect(keys).toEqual([
        'defaultCurrency',
        'defaultTimezone',
        'dateFormat',
        'timeFormat',
        'numberFormat',
        'defaultLanguage',
        'weekStartDay',
      ]);
    });

    it('uses labeled options for every field', () => {
      for (const [key, metadata] of Object.entries(APP_DEFAULTS_SETTINGS.general.metadata)) {
        expect(metadata.options, `${key} should have options`).toBeDefined();
        for (const opt of metadata.options!) {
          expect(typeof opt, `${key} option must be labeled object`).toBe('object');
        }
      }
    });

    it('defaults match the value in the first matching option', () => {
      for (const [key, defaultValue] of Object.entries(APP_DEFAULTS_SETTINGS.general.defaults)) {
        const options = APP_DEFAULTS_SETTINGS.general.metadata[key]!.options!;
        const values = options.map((o) => (typeof o === 'string' ? o : o.value));
        expect(values, `${key} default should be in options`).toContain(defaultValue);
      }
    });
  });

  describe('preferences module definition', () => {
    it('has the expected fields', () => {
      expect(Object.keys(APP_DEFAULTS_SETTINGS.preferences.defaults)).toEqual([
        'fiscalYearStart',
        'defaultPageSize',
      ]);
    });

    it('defaults match a value in the options list', () => {
      for (const [key, defaultValue] of Object.entries(APP_DEFAULTS_SETTINGS.preferences.defaults)) {
        const options = APP_DEFAULTS_SETTINGS.preferences.metadata[key]!.options!;
        const values = options.map((o) => (typeof o === 'string' ? o : o.value));
        expect(values).toContain(defaultValue);
      }
    });
  });
});
