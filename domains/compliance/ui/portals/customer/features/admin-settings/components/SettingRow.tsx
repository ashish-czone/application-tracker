import { FormInput, FormSelect } from '@packages/ui';
import type { SettingsField } from '@packages/settings-ui';

export interface SettingRowProps {
  field: SettingsField;
}

function normalizeOptions(options: SettingsField['metadata']['options']) {
  if (!options) return [];
  return options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );
}

export function SettingRow({ field }: SettingRowProps) {
  const { metadata } = field;
  const hasOptions = !!metadata.options && metadata.options.length > 0;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-8 items-start py-5">
      <div>
        <span className="text-sm font-sans font-medium text-ink">{metadata.label}</span>
        {metadata.description && (
          <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
            {metadata.description}
          </span>
        )}
      </div>

      <div>
        {hasOptions ? (
          <FormSelect
            name={field.key}
            options={normalizeOptions(metadata.options)}
            placeholder="Select..."
          />
        ) : (
          <FormInput name={field.key} ariaLabel={metadata.label} />
        )}
      </div>
    </div>
  );
}
