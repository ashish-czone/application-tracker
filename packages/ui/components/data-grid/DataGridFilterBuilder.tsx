import { useState, useRef, useEffect, useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Filter, ChevronLeft, Check, X } from 'lucide-react';
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
}

type Step = 'field' | 'operator' | 'value';

export function DataGridFilterBuilder({
  fields,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
}: DataGridFilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('field');
  const [selectedField, setSelectedField] = useState<DataGridFilterField | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<FilterOperator | null>(null);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('field');
    setSelectedField(null);
    setSelectedOperator(null);
    setSearch('');
  }, []);

  useEffect(() => {
    if (open) {
      resetState();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, resetState]);

  useEffect(() => {
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [step]);

  const handleFieldSelect = (field: DataGridFilterField) => {
    setSelectedField(field);
    const operators = field.operators ?? OPERATORS_BY_FIELD_TYPE[field.fieldType] ?? ['eq'];
    if (operators.length === 1) {
      // Skip operator step if only one operator
      handleOperatorSelect(operators[0], field);
    } else {
      setStep('operator');
    }
  };

  const handleOperatorSelect = (operator: FilterOperator, field?: DataGridFilterField) => {
    const f = field ?? selectedField;
    setSelectedOperator(operator);
    if (operator === 'isNull' || operator === 'isNotNull') {
      onAddFilter({ field: f!.key, operator, value: null });
      setOpen(false);
    } else {
      setStep('value');
    }
  };

  const handleValueSelect = (value: unknown) => {
    if (!selectedField || !selectedOperator) return;
    onAddFilter({ field: selectedField.key, operator: selectedOperator, value });
    setOpen(false);
  };

  const handleBack = () => {
    if (step === 'value') {
      setSelectedOperator(null);
      setStep('operator');
    } else if (step === 'operator') {
      setSelectedField(null);
      setStep('field');
    }
  };

  const getFieldLabel = (fieldKey: string) => fields.find((f) => f.key === fieldKey)?.label ?? fieldKey;

  const getValueLabel = (expr: FilterExpression) => {
    if (expr.operator === 'isNull' || expr.operator === 'isNotNull') return '';
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

  // Header text for each step
  const headerText = step === 'field'
    ? 'Filter by'
    : step === 'operator'
    ? selectedField?.label ?? ''
    : `${selectedField?.label ?? ''} ${OPERATOR_LABELS[selectedOperator!] ?? ''}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filter chips */}
      {filters.map((expr) => (
        <Badge
          key={expr.field}
          variant="secondary"
          onRemove={() => onRemoveFilter(expr.field)}
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

      {/* Add filter button + popover */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-dashed border-input bg-background px-2.5 h-7 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
              open && 'bg-accent text-accent-foreground',
            )}
          >
            <Filter className="h-3 w-3" />
            Filter
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
            sideOffset={4}
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              {step !== 'field' && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <span className="text-xs font-medium text-muted-foreground truncate">{headerText}</span>
            </div>

            {/* Step content */}
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
            {step === 'operator' && selectedField && (
              <OperatorPicker
                field={selectedField}
                onSelect={handleOperatorSelect}
              />
            )}
            {step === 'value' && selectedField && selectedOperator && (
              <ValueInput
                field={selectedField}
                operator={selectedOperator}
                onSubmit={handleValueSelect}
                inputRef={inputRef}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
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
        {fields.map((field) => (
          <Command.Item
            key={field.key}
            value={field.label}
            onSelect={() => onSelect(field)}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
          >
            <span className="flex-1 truncate">{field.label}</span>
            {activeFieldKeys.has(field.key) && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Operator Picker
// ---------------------------------------------------------------------------
function OperatorPicker({
  field,
  onSelect,
}: {
  field: DataGridFilterField;
  onSelect: (op: FilterOperator) => void;
}) {
  const operators = field.operators ?? OPERATORS_BY_FIELD_TYPE[field.fieldType] ?? ['eq'];

  return (
    <div className="max-h-52 overflow-y-auto p-1">
      {operators.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onSelect(op)}
          className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent text-left"
        >
          {OPERATOR_LABELS[op] ?? op}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Value Input
// ---------------------------------------------------------------------------
function ValueInput({
  field,
  operator,
  onSubmit,
  inputRef,
}: {
  field: DataGridFilterField;
  operator: FilterOperator;
  onSubmit: (value: unknown) => void;
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
    return <BetweenValueInput fieldType={field.fieldType} onSubmit={onSubmit} inputRef={inputRef} />;
  }

  if (hasOptions && isMultiSelect) {
    return <MultiSelectValueInput field={field} onSubmit={onSubmit} />;
  }

  if (hasOptions) {
    return <SelectValueInput field={field} onSubmit={onSubmit} inputRef={inputRef} />;
  }

  return <TextValueInput fieldType={field.fieldType} onSubmit={onSubmit} inputRef={inputRef} />;
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
  onSubmit,
  inputRef,
}: {
  fieldType: string;
  onSubmit: (v: unknown) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

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

// --- Multi-select (checkboxes) ---
function MultiSelectValueInput({
  field,
  onSubmit,
}: {
  field: DataGridFilterField;
  onSubmit: (v: unknown) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const options = field.options ?? [];
  const filtered = options.filter(
    (o) => !search || o.label.toLowerCase().includes(search.toLowerCase()),
  );

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
      <div className="max-h-44 overflow-y-auto p-1">
        {filtered.map((opt) => (
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
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No options</p>
        )}
      </div>
      <div className="border-t px-2 py-2">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onSubmit(selected)}
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
  onSubmit,
  inputRef,
}: {
  field: DataGridFilterField;
  onSubmit: (v: unknown) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [search, setSearch] = useState('');
  const [asyncResults, setAsyncResults] = useState<DataGridFilterFieldOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  // Async search
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
      <Command.List className="max-h-44 overflow-y-auto p-1">
        {isSearching ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">Searching...</div>
        ) : (
          <>
            <Command.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              No options found
            </Command.Empty>
            {options.map((opt) => (
              <Command.Item
                key={opt.value}
                value={opt.label}
                onSelect={() => onSubmit(opt.value)}
                className="flex items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
              >
                <span className="truncate">{opt.label}</span>
              </Command.Item>
            ))}
          </>
        )}
      </Command.List>
    </Command>
  );
}

// --- Text/number/date input ---
function TextValueInput({
  fieldType,
  onSubmit,
  inputRef,
}: {
  fieldType: string;
  onSubmit: (v: unknown) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState('');

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
