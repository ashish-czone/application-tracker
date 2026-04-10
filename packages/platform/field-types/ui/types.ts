import type { ReactNode, ComponentType } from 'react';
import type { z } from 'zod';

// ---------------------------------------------------------------------------
// UI render context — passed to FormComponent, ViewComponent, CellFormatter
// ---------------------------------------------------------------------------

export interface FieldRenderProps {
  field: {
    fieldKey: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    isReadonly: boolean;
    maxLength?: number | null;
    lookupEntity?: string | null;
    tagGroupSlug?: string | null;
    categoryGroupSlug?: string | null;
    fileAccept?: string[] | null;
    fileMaxSize?: number | null;
    picklistOptions?: { label: string; value: string }[];
  };
  resolvedLabel?: string | null;
  lookupOptions?: { label: string; value: string }[];
  chipOptions?: { label: string; value: string; color?: string }[];
  onSearch?: (query: string) => Promise<{ label: string; value: string }[]>;
  onChipSearch?: (query: string) => Promise<{ label: string; value: string; color?: string }[]>;
}

// ---------------------------------------------------------------------------
// UI-side field type definition (extends the core definition)
// ---------------------------------------------------------------------------

export interface FieldTypeUIDefinition {
  type: string;
  FormComponent: ComponentType<FieldRenderProps>;
  ViewComponent: (value: unknown, props: FieldRenderProps) => ReactNode;
  CellFormatter: (value: unknown, row: Record<string, unknown>, props: FieldRenderProps) => ReactNode | string;
  zodSchema: (ctx: { maxLength?: number | null; isRequired?: boolean }) => z.ZodTypeAny;
}

// ---------------------------------------------------------------------------
// Zod schema context
// ---------------------------------------------------------------------------

export interface ZodSchemaContext {
  maxLength?: number | null;
  isRequired?: boolean;
}
