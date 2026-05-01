import { FormSelect } from '@packages/ui';
import { useOrgUnitOptions } from '../hooks';

interface OrgUnitComboboxBaseProps {
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

interface OrgUnitComboboxControlledProps extends OrgUnitComboboxBaseProps {
  /** react-hook-form field name. Use this OR `value`+`onChange`, not both. */
  name: string;
  value?: never;
  onChange?: never;
}

interface OrgUnitComboboxStandaloneProps extends OrgUnitComboboxBaseProps {
  name?: never;
  /** Currently-selected org-unit id, or empty string for "nothing selected". */
  value: string;
  onChange: (value: string) => void;
}

export type OrgUnitComboboxProps =
  | OrgUnitComboboxControlledProps
  | OrgUnitComboboxStandaloneProps;

/**
 * Drop-in single-select picker for org-units. Loads the full unit list once
 * (sharing the `useOrgUnits` cache) and renders the platform `FormSelect`,
 * which handles search, keyboard nav, and react-hook-form binding when a
 * `name` prop is supplied.
 *
 * Standalone:
 *   <OrgUnitCombobox value={unitId} onChange={setUnitId} placeholder="Pick a unit" />
 *
 * Inside a react-hook-form `<Form>`:
 *   <OrgUnitCombobox name="orgUnitId" label="Org unit" />
 *
 * While the unit list is loading the trigger shows "Loading…" and is disabled.
 * Bounded reference data — see `.claude/rules/data-fetching.md` — so the full
 * list is fetched once per session, no server-side search needed.
 */
export function OrgUnitCombobox(props: OrgUnitComboboxProps) {
  const { options, isLoading } = useOrgUnitOptions();
  const placeholder = isLoading ? 'Loading…' : props.placeholder ?? 'Select org unit…';
  const disabled = isLoading || props.disabled;

  if ('value' in props && props.onChange) {
    return (
      <FormSelect
        label={props.label}
        description={props.description}
        className={props.className}
        options={options}
        value={props.value}
        onChange={props.onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  }

  return (
    <FormSelect
      name={props.name!}
      label={props.label}
      description={props.description}
      className={props.className}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
