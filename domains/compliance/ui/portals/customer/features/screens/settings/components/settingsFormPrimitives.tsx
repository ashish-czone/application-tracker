import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface FieldGroupProps {
  label: string;
  children: ReactNode;
}

export function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export interface TextInputProps {
  value: string;
  readOnly?: boolean;
  placeholder?: string;
}

export function TextInput({ value, readOnly, placeholder }: TextInputProps) {
  return (
    <input
      type="text"
      defaultValue={value}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none transition-colors ${
        readOnly ? 'bg-paper-sunken text-ink-muted cursor-not-allowed' : 'focus:border-ink'
      }`}
    />
  );
}

export interface PasswordInputProps {
  placeholder: string;
}

export function PasswordInput({ placeholder }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-9 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
      >
        {visible ? (
          <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
        ) : (
          <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-none items-center border transition-colors ${
        checked ? 'bg-authority border-authority' : 'bg-paper-sunken border-rule'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 bg-paper-raised border border-rule transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

export function SectionDivider() {
  return <div className="border-t border-rule" />;
}
