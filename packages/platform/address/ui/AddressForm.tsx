import { FormInput, FormSelect } from '@packages/ui';
import type { AddressColumnsOptions } from '@packages/address/schema';

type CountryOption = { label: string; value: string };

export interface AddressFormProps extends AddressColumnsOptions {
  /** Optional section label rendered above the inputs. */
  label?: string;
  /** Passed through to each input; disables the whole fieldset. */
  disabled?: boolean;
  /** Static list of country options for the country picker. */
  countryOptions?: CountryOption[];
  /** Async search for countries — used when `countryOptions` is not provided. */
  onCountrySearch?: (query: string) => Promise<CountryOption[]>;
  /** Pre-resolved display label for the currently-selected country (async mode). */
  initialCountryLabel?: string;
}

function fieldName(prefix: string, base: string): string {
  return prefix ? `${prefix}_${base}` : base;
}

/**
 * Composite form for a single address. Expects to be rendered inside a
 * `FormProvider` (react-hook-form). Each sub-input is wired to a flat field
 * name matching the corresponding Drizzle column produced by `addressColumns`.
 */
export function AddressForm({
  prefix = '',
  label,
  disabled,
  countryOptions,
  onCountrySearch,
  initialCountryLabel,
}: AddressFormProps) {
  const line1 = fieldName(prefix, 'address_line1');
  const line2 = fieldName(prefix, 'address_line2');
  const city = fieldName(prefix, 'city');
  const state = fieldName(prefix, 'state');
  const postalCode = fieldName(prefix, 'postal_code');
  const countryId = fieldName(prefix, 'country_id');

  return (
    <fieldset disabled={disabled} className="space-y-3 min-w-0">
      {label && (
        <legend className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium">
          {label}
        </legend>
      )}

      <FormInput name={line1} label="Address line 1" placeholder="Street, building, flat" />
      <FormInput name={line2} label="Address line 2" placeholder="Landmark, floor, suite" />

      <div className="grid grid-cols-2 gap-3">
        <FormInput name={city} label="City" />
        <FormInput name={state} label="State / region" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormInput name={postalCode} label="Postal code" />
        <FormSelect
          name={countryId}
          label="Country"
          options={countryOptions}
          onSearch={onCountrySearch}
          initialDisplayValue={initialCountryLabel}
          placeholder="Select country"
        />
      </div>
    </fieldset>
  );
}
