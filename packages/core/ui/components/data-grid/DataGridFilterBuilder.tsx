import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Filter, ChevronLeft, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../Badge';
import { useDebounce } from '../../hooks/useDebounce';
import type { FilterExpression } from './filter-types';
import { OPERATORS_BY_FIELD_TYPE, OPERATOR_LABELS } from './filter-types';
import type { FilterOperator } from './filter-types';
import type { DataGridFilterField, DataGridFilterFieldOption } from './types';

interface DataGridFilterBuilderProps {
  fields: DataGridFilterField[];
  filters: FilterExpression[];
  onAddFilter: (expr: FilterExpression) => void;
  onRemoveFilter: (field: string) => void;
  onClearAll: () => void;
  /** When true, the trigger renders without inline chips. Chips should be rendered separately via `DataGridFilterChipsRow`. */
  hideChips?: boolean;
}

export interface DataGridFilterBuilderHandle {
  editFilter: (fieldKey: string) => void;
}

type Step = 'field' | 'configure';

export const DataGridFilterBuilder = forwardRef<DataGridFilterBuilderHandle, DataGridFilterBuilderProps>(function DataGridFilterBuilder({
  fields,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  hideChips = false,
}, ref) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('field');
  const [selectedField, setSelectedField] = useState<DataGridFilterField | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<FilterOperator | null>(null);
  const [editingValue, setEditingValue] = useState<unknown>(undefined);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && !editingRef.current) {
      setStep('field');
      setSelectedField(null);
      setSelectedOperator(null);
      setEditingValue(undefined);
      setEditingFieldKey(null);
      setSearch('');
    }
    editingRef.current = false;
    setOpen(nextOpen);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleFieldSelect = (field: DataGridFilterField) => {
    setSelectedField(field);
    const operators = field.operators ?? OPERATORS_BY_FIELD_TYPE[field.fieldType] ?? ['eq'];
    setSelectedOperator(operators[0]);
    setEditingValue(undefined);
    setStep('configure');
    setSearch('');
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    setSelectedOperator(operator);
    if (operator === 'isNull' || operator === 'isNotNull') {
      onAddFilter({ field: selectedField!.key, operator, value: null });
      setOpen(false);
    }
  };

  const handleValueSelect = (value: unknown, displayValue?: string) => {
    if (!selectedField || !selectedOperator) return;
    onAddFilter({ field: selectedField.key, operator: selectedOperator, value, displayValue });
    setOpen(false);
  };

  const handleChipClick = useCallback((expr: FilterExpression) => {
    const field = fields.find((f) => f.key === expr.field);
    if (!field) return;
    editingRef.current = true;
    setSelectedField(field);
    setSelectedOperator(expr.operator);
    setEditingValue(expr.value);
    setEditingFieldKey(expr.field);
    setStep('configure');
    setSearch('');
    setOpen(true);
  }, [fields]);

  useImperativeHandle(ref, () => ({
    editFilter: (fieldKey: string) => {
      const expr = filters.find((f) => f.field === fieldKey);
      if (expr) handleChipClick(expr);
    },
  }), [filters, handleChipClick]);

  const handleBack = () => {
    setSelectedField(null);
    setSelectedOperator(null);
    setEditingValue(undefined);
    setStep('field');
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const getFieldLabel = (fieldKey: string) => fields.find((f) => f.key === fieldKey)?.label ?? fieldKey;

  const getValueLabel = (expr: FilterExpression) => {
    if (expr.operator === 'isNull' || expr.operator === 'isNotNull') return '';
    if (expr.displayValue) return expr.displayValue;
    const field = fields.find((f) => f.key === expr.field);
    if (Array.isArray(expr.value)) {
      return (expr.value as string[])
        .map((v) => field?.options?.find((o) => o.value === v)?.label ?? v)
        .join(', ');
    }
    return field?.options?.find((o) => o.value === expr.value)?.label ?? String(expr.value ?? '');
  };

  const getChipLabel = (expr: FilterExpression) => {
    const fieldLabel = getFieldLabel(expr.field);
    const opLabel = OPERATOR_LABELS[expr.operator] ?? expr.operator;
    const valueLabel = getValueLabel(expr);
    return valueLabel ? `${fieldLabel} ${opLabel} ${valueLabel}` : `${fieldLabel} ${opLabel}`;
  };

  const popoverContent = (
    <Popover.Content
      className="z-50 w-72 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
      sideOffset={4}
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        {step === 'configure' && !editingFieldKey && (
          <button
            type="button"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs font-medium text-muted-foreground truncate">
          {step === 'field' ? 'Filter by' : selectedField?.label ?? ''}
        </span>
      </div>

      {step === 'field' && (
        <FieldPicker
          fields={fields}
          filters={filters}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleFieldSelect}
          inputRef={inputRef}
        />
      )}

      {step === 'configure' && selectedField && selectedOperator && (
        <OperatorAndValueStep
          field={selectedField}
          operator={selectedOperator}
          initialValue={editingValue}
          onOperatorChange={handleOperatorChange}
          onSubmit={handleValueSelect}
          inputRef={inputRef}
        />
      )}
    </Popover.Content>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        {/* Inline chips — only when hideChips is false (legacy layout). */}
        {!hideChips && filters.map((expr) => {
          const badge = (
            <Badge
              key={expr.field}
              variant="secondary"
              className="cursor-pointer"
              onRemove={() => onRemoveFilter(expr.field)}
              onClick={() => handleChipClick(expr)}
            >
              {getChipLabel(expr)}
            </Badge>
          );
          return editingFieldKey === expr.field
            ? <Popover.Anchor key={expr.field} asChild>{badge}</Popover.Anchor>
            : badge;
        })}

        {!hideChips && filters.length > 1 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}

        <Popover.Trigger asChild>
          <button
            type="button"
            data-slot="filter-trigger"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open && 'bg-accent text-accent-foreground',
              filters.length > 0 && 'border-primary/60 text-foreground',
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {filters.length > 0 && (
              <span
                data-slot="filter-count"
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums"
              >
                {filters.length}
              </span>
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          {popoverContent}
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Chips row — rendered separately from the filter trigger so the toolbar
// keeps a single-row layout. Clicking a chip opens the builder in edit mode
// for that field via the builder's imperative handle.
// ---------------------------------------------------------------------------
interface DataGridFilterChipsRowProps {
  fields: DataGridFilterField[];
  filters: FilterExpression[];
  onRemoveFilter: (field: string) => void;
  onClearAll: () => void;
  onEditFilter?: (fieldKey: string) => void;
}

export function DataGridFilterChipsRow({
  fields,
  filters,
  onRemoveFilter,
  onClearAll,
  onEditFilter,
}: DataGridFilterChipsRowProps) {
  if (filters.length === 0) return null;

  const getFieldLabel = (fieldKey: string) => fields.find((f) => f.key === fieldKey)?.label ?? fieldKey;
  const getValueLabel = (expr: FilterExpression) => {
    if (expr.operator === 'isNull' || expr.operator === 'isNotNull') return '';
    if (expr.displayValue) return expr.displayValue;
    const field = fields.find((f) => f.key === expr.field);
    if (Array.isArray(expr.value)) {
      return (expr.value as string[])
        .map((v) => field?.options?.find((o) => o.value === v)?.label ?? v)
        .join(', ');
    }
    return field?.options?.find((o) => o.value === expr.value)?.label ?? String(expr.value ?? '');
  };
  const getChipLabel = (expr: FilterExpression) => {
    const fieldLabel = getFieldLabel(expr.field);
    const opLabel = OPERATOR_LABELS[expr.operator] ?? expr.operator;
    const valueLabel = getValueLabel(expr);
    return valueLabel ? `${fieldLabel} ${opLabel} ${valueLabel}` : `${fieldLabel} ${opLabel}`;
  };

  return (
    <div data-slot="filter-chips-row" className="flex items-center gap-2 flex-wrap">
      {filters.map((expr) => (
        <Badge
          key={expr.field}
          variant="secondary"
          className={cn(onEditFilter && 'cursor-pointer')}
          onRemove={() => onRemoveFilter(expr.field)}
          onClick={onEditFilter ? () => onEditFilter(expr.field) : undefined}
        >
          {getChipLabel(expr)}
        </Badge>
      ))}
      {filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Field Picker
// ---------------------------------------------------------------------------
function FieldPicker({
  fields,
  filters,
  search,
  onSearchChange,
  onSelect,
  inputRef,
}: {
  fields: DataGridFilterField[];
  filters: FilterExpression[];
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (field: DataGridFilterField) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const activeFieldKeys = new Set(filters.map((f) => f.field));
  const availableFields = fields.filter((f) => !activeFieldKeys.has(f.key));

  return (
    <Command className="[&_[cmdk-group]]:p-1 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5">
      <div className="px-2 pt-2 pb-1">
        <Command.Input
          ref={inputRef}
          value={search}
          onValueChange={onSearchChange}
          placeholder="Search fields..."
          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <Command.List className="max-h-52 overflow-y-auto p-1">
        <Command.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
          No fields found
        </Command.Empty>
        {availableFields.map((field) => (
          <Command.Item
            key={field.key}
            value={field.label}
            onSelect={() => onSelect(field)}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
          >
            <span className="flex-1 truncate">{field.label}</span>
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Operator selector (top) + Value input (bottom) — combined
// ---------------------------------------------------------------------------
function OperatorAndValueStep({
  field,
  operator,
  initialValue,
  onOperatorChange,
  onSubmit,
  inputRef,
}: {
  field: DataGridFilterField;
  operator: FilterOperator;
  initialValue?: unknown;
  onOperatorChange: (op: FilterOperator) => void;
  onSubmit: (value: unknown, displayValue?: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const operators = field.operators ?? OPERATORS_BY_FIELD_TYPE[field.fieldType] ?? ['eq'];
  const isNoValueOperator = operator === 'isNull' || operator === 'isNotNull';

  return (
    <div className="flex flex-col">
      {/* Operator selector */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b">
        {operators.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onOperatorChange(op)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              op === operator
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {OPERATOR_LABELS[op] ?? op}
          </button>
        ))}
      </div>

      {/* Value input — hidden for isNull/isNotNull */}
      {!isNoValueOperator && (
        <ValueInput
          field={field}
          operator={operator}
          initialValue={initialValue}
          onSubmit={onSubmit}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value Input — adapts to field type + operator
// ---------------------------------------------------------------------------
function ValueInput({
  field,
  operator,
  initialValue,
  onSubmit,
  inputRef,
}: {
  field: DataGridFilterField;
  operator: FilterOperator;
  initialValue?: unknown;
  onSubmit: (value: unknown, displayValue?: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isBooleanField = field.fieldType === 'boolean';
  const isMultiSelect = operator === 'in' || operator === 'notIn';
  const isBetween = operator === 'between';
  const hasOptions = (field.options && field.options.length > 0) || !!field.onSearchOptions;

  if (isBooleanField) {
    return <BooleanValueInput onSubmit={onSubmit} />;
  }

  if (isBetween) {
    return <BetweenValueInput fieldType={field.fieldType} initialValue={initialValue} onSubmit={onSubmit} inputRef={inputRef} />;
  }

  if (hasOptions && isMultiSelect) {
    return <MultiSelectValueInput field={field} initialValue={initialValue} onSubmit={onSubmit} />;
  }

  if (hasOptions) {
    return <SelectValueInput field={field} initialValue={initialValue} onSubmit={onSubmit} inputRef={inputRef} />;
  }

  return <TextValueInput fieldType={field.fieldType} initialValue={initialValue} onSubmit={onSubmit} inputRef={inputRef} />;
}

// --- Boolean ---
function BooleanValueInput({ onSubmit }: { onSubmit: (v: unknown) => void }) {
  return (
    <div className="p-2 flex gap-2">
      <button
        type="button"
        onClick={() => onSubmit('true')}
        className="flex-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onSubmit('false')}
        className="flex-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
      >
        No
      </button>
    </div>
  );
}

// --- Between (min/max) ---
function BetweenValueInput({
  fieldType,
  initialValue,
  onSubmit,
  inputRef,
}: {
  fieldType: string;
  initialValue?: unknown;
  onSubmit: (v: unknown) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const initial = Array.isArray(initialValue) ? initialValue : ['', ''];
  const [min, setMin] = useState(String(initial[0] ?? ''));
  const [max, setMax] = useState(String(initial[1] ?? ''));

  const inputType = ['number', 'currency', 'decimal'].includes(fieldType) ? 'number' : 'date';

  return (
    <div className="p-2 space-y-2">
      <input
        ref={inputRef}
        type={inputType}
        value={min}
        onChange={(e) => setMin(e.target.value)}
        placeholder="Min"
        className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <input
        type={inputType}
        value={max}
        onChange={(e) => setMax(e.target.value)}
        placeholder="Max"
        className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <button
        type="button"
        disabled={!min || !max}
        onClick={() => onSubmit([min, max])}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Apply
      </button>
    </div>
  );
}

// --- Multi-select (checkboxes) — supports both static and async options ---
function MultiSelectValueInput({
  field,
  initialValue,
  onSubmit,
}: {
  field: DataGridFilterField;
  initialValue?: unknown;
  onSubmit: (v: unknown, displayValue?: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(initialValue) ? (initialValue as string[]) : [],
  );
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<DataGridFilterFieldOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (!field.onSearchOptions) return;
    let cancelled = false;
    setIsSearching(true);
    field.onSearchOptions(debouncedSearch).then((results) => {
      if (!cancelled) {
        setAsyncResults(results);
        setIsSearching(false);
      }
    }).catch(() => {
      if (!cancelled) setIsSearching(false);
    });
    return () => { cancelled = true; };
  }, [debouncedSearch, field]);

  const options = field.options
    ? field.options.filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase()))
    : asyncResults;

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  return (
    <div className="flex flex-col">
      <div className="px-2 pt-2 pb-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div className="max-h-40 overflow-y-auto p-1">
        {isSearching ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">Searching...</div>
        ) : (
          <>
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="rounded border-input"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
            {options.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">No options</p>
            )}
          </>
        )}
      </div>
      <div className="border-t px-2 py-2">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => {
            const labels = selected
              .map((v) => options.find((o) => o.value === v)?.label ?? v)
              .join(', ');
            onSubmit(selected, labels);
          }}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply ({selected.length})
        </button>
      </div>
    </div>
  );
}

// --- Single-select from options ---
function SelectValueInput({
  field,
  initialValue,
  onSubmit,
  inputRef,
}: {
  field: DataGridFilterField;
  initialValue?: unknown;
  onSubmit: (v: unknown, displayValue?: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<DataGridFilterFieldOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (!field.onSearchOptions) return;
    let cancelled = false;
    setIsSearching(true);
    field.onSearchOptions(debouncedSearch).then((results) => {
      if (!cancelled) {
        setAsyncResults(results);
        setIsSearching(false);
      }
    }).catch(() => {
      if (!cancelled) setIsSearching(false);
    });
    return () => { cancelled = true; };
  }, [debouncedSearch, field]);

  const options = field.options
    ? field.options.filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase()))
    : asyncResults;

  return (
    <Command className="[&_[cmdk-group]]:p-1 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5">
      <div className="px-2 pt-2 pb-1">
        <Command.Input
          ref={inputRef}
          value={search}
          onValueChange={setSearch}
          placeholder="Search..."
          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <Command.List className="max-h-40 overflow-y-auto p-1">
        {isSearching ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">Searching...</div>
        ) : (
          <>
            <Command.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              No options found
            </Command.Empty>
            {options.map((opt) => {
              const isSelected = opt.value === initialValue;
              return (
                <Command.Item
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => onSubmit(opt.value, opt.label)}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </Command.Item>
              );
            })}
          </>
        )}
      </Command.List>
    </Command>
  );
}

// --- Text/number/date input ---
function TextValueInput({
  fieldType,
  initialValue,
  onSubmit,
  inputRef,
}: {
  fieldType: string;
  initialValue?: unknown;
  onSubmit: (v: unknown) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : '');

  const inputType = ['number', 'currency', 'decimal'].includes(fieldType)
    ? 'number'
    : ['date', 'datetime'].includes(fieldType)
    ? 'date'
    : 'text';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  return (
    <div className="p-2 space-y-2">
      <input
        ref={inputRef}
        type={inputType}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter value..."
        className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <button
        type="button"
        disabled={!value}
        onClick={() => onSubmit(value)}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Apply
      </button>
    </div>
  );
}
