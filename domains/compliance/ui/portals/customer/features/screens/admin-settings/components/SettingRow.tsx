import { FormInput, FormSelect } from '@packages/ui';
import type { AdminSettingField } from '../data/adminSettingsMock';
import { LogoUploadField } from './LogoUploadField';

export interface SettingRowProps {
  field: AdminSettingField;
}

export function SettingRow({ field }: SettingRowProps) {
  return (
    <div className="grid grid-cols-[1fr_320px] gap-8 items-start py-5">
      <div>
        <span className="text-sm font-sans font-medium text-ink">{field.label}</span>
        <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
          {field.description}
        </span>
      </div>

      <div>
        {field.type === 'text' && <FormInput name={field.key} ariaLabel={field.label} />}
        {field.type === 'select' && (
          <FormSelect name={field.key} options={field.options} placeholder="Select..." />
        )}
        {field.type === 'logo' && <LogoUploadField />}
      </div>
    </div>
  );
}
