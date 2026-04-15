// Components — ungrouped
export { Button, type ButtonProps, type ButtonTone, buttonVariants } from './components/Button';
export { ButtonGroup, type ButtonGroupProps } from './components/ButtonGroup';

// Data display
export { DateFormat, type DateFormatProps } from './components/data-display/DateFormat';
export { NumberFormat, type NumberFormatProps } from './components/data-display/NumberFormat';
export { CurrencyFormat, type CurrencyFormatProps } from './components/data-display/CurrencyFormat';
export { Badge, type BadgeProps, badgeVariants } from './components/Badge';
export { Skeleton } from './components/Skeleton';

// Components — form
export { Input, type InputProps } from './components/form/Input';
export { Label } from './components/form/Label';
export { Form } from './components/form/Form';
export { FormInput, type AsyncValidationStatus } from './components/form/FormInput';
export { FormEmailInput } from './components/form/FormEmailInput';
export { FormPasswordInput } from './components/form/FormPasswordInput';
export { FormPhoneInput } from './components/form/FormPhoneInput';
export { FormSelect, type FormSelectProps } from './components/form/FormSelect';
export { Combobox, type ComboboxProps } from './components/form/Combobox';
export { MultiSelect, type MultiSelectProps } from './components/form/MultiSelect';
export type { ComboboxOption } from './hooks/useComboboxState';
export { FormTextarea } from './components/form/FormTextarea';
export { FormCheckbox } from './components/form/FormCheckbox';
export { Checkbox, type CheckboxProps } from './components/form/Checkbox';
export { RadioGroup, RadioGroupItem } from './components/form/RadioGroup';
export { FormCurrencyInput } from './components/form/FormCurrencyInput';
export { FormRichText } from './components/form/FormRichText';
export { FormChipInput, ChipInput, type ChipOption } from './components/form/FormChipInput';
// Legacy ChipInput re-export kept for any remaining call sites.
export { FormFileInput } from './components/form/FormFileInput';
export { FormDatePicker } from './components/form/FormDatePicker';
export {
  FormDateRangePicker,
  type FormDateRangePickerProps,
  type DateRangeValue,
} from './components/form/FormDateRangePicker';
export { Calendar } from './components/form/Calendar';
export { PasswordStrength } from './components/form/PasswordStrength';
export { Slider, type SliderProps } from './components/form/Slider';
export { FormSlider } from './components/form/FormSlider';

// Components — feedback
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/feedback/Dialog';

export { Toaster, toast } from './components/feedback/Toast';
export { ConfirmDialog } from './components/feedback/ConfirmDialog';
export { Progress, type ProgressProps } from './components/feedback/Progress';

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './components/feedback/Tooltip';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './components/feedback/Sheet';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
} from './components/feedback/DropdownMenu';

// Components — layout
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/layout/Card';

// Components — layout
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/layout/Tabs';
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './components/layout/Accordion';
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './components/layout/Breadcrumb';

// Components — data-grid
export { DataGrid } from './components/data-grid/DataGrid';
export { DataGridFilters } from './components/data-grid/DataGridFilters';
export { DataGridFilterBuilder } from './components/data-grid/DataGridFilterBuilder';
export type {
  DataGridProps,
  DataGridFilter,
  DataGridFilterConfig,
  DataGridFilterOption,
  DataGridFilterField,
  DataGridFilterFieldOption,
  DataGridEmptyState,
  DataGridBulkAction,
} from './components/data-grid/types';

// Filter types + constants
export type { FilterOperator, FilterExpression } from './components/data-grid/filter-types';
export { OPERATORS_BY_FIELD_TYPE, OPERATOR_LABELS } from './components/data-grid/filter-types';

// Components — data-grid cell renderers
export { AvatarNameCell } from './components/data-grid/cell-renderers/AvatarNameCell';
export { StatusBadgeCell, createStatusBadgeCell, type StatusColors } from './components/data-grid/cell-renderers/StatusBadgeCell';
export { createRowActionsColumn, type RowAction, type RowActionsColumnOptions } from './components/data-grid/cell-renderers/RowActionsCell';
export type { CellRendererProps } from './components/data-grid/cell-renderers/types';

// Components — kanban
export { KanbanBoard } from './components/kanban/KanbanBoard';
export { KanbanColumn } from './components/kanban/KanbanColumn';
export { KanbanCard } from './components/kanban/KanbanCard';
export type { KanbanBoardProps, KanbanColumnDef, KanbanCardData } from './components/kanban/types';

// Hooks
export { useDebounce } from './hooks/useDebounce';
export { useDataGridParams } from './hooks/useDataGridParams';
export { useActiveFilters } from './hooks/useActiveFilters';
export { useAsyncValidator } from './hooks/useAsyncValidator';

// Utilities
export { cn } from './lib/utils';

// Re-export TanStack Table types for column definitions
export { type ColumnDef, createColumnHelper } from '@tanstack/react-table';

// Kit — "The Instrument" editorial widget library
export * from './kit';
