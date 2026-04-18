// ─────────────────────────────────────────────────────────────────────────────
// Components — ungrouped primitives
// ─────────────────────────────────────────────────────────────────────────────
export { Button, type ButtonProps, type ButtonTone, buttonVariants } from './components/Button';
export { ButtonGroup, type ButtonGroupProps } from './components/ButtonGroup';
export { Badge, type BadgeProps, badgeVariants } from './components/Badge';
export { Skeleton } from './components/Skeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Components — data-display
// ─────────────────────────────────────────────────────────────────────────────
export { DateFormat, type DateFormatProps } from './components/data-display/DateFormat';
export { NumberFormat, type NumberFormatProps } from './components/data-display/NumberFormat';
export { CurrencyFormat, type CurrencyFormatProps } from './components/data-display/CurrencyFormat';
export { Sparkline, type SparklineProps } from './components/data-display/Sparkline';
export { MetricKPI, type MetricKPIProps } from './components/data-display/MetricKPI';
export { StatusDonut, type StatusDonutProps, type StatusDonutSegment } from './components/data-display/StatusDonut';
export { HierarchyTreeView, type HierarchyTreeViewProps, type HierarchyNode } from './components/data-display/HierarchyTreeView';
export {
  ActivityTimeline,
  type ActivityTimelineProps,
  type TimelineEvent,
  type TimelineIconConfig,
} from './components/data-display/ActivityTimeline';
export { DetailRow, type DetailRowProps } from './components/data-display/DetailRow';

// ─────────────────────────────────────────────────────────────────────────────
// Components — form
// ─────────────────────────────────────────────────────────────────────────────
export { Input, type InputProps } from './components/form/Input';
export { SearchInput, type SearchInputProps, type SearchInputVariant } from './components/form/SearchInput';
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

// ─────────────────────────────────────────────────────────────────────────────
// Components — feedback
// ─────────────────────────────────────────────────────────────────────────────
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

export { EmptyState, type EmptyStateProps } from './components/feedback/EmptyState';

// ─────────────────────────────────────────────────────────────────────────────
// Components — layout
// ─────────────────────────────────────────────────────────────────────────────
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/layout/Card';
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
export { Eyebrow, type EyebrowProps } from './components/layout/Eyebrow';
export { SectionRule, type SectionRuleProps } from './components/layout/SectionRule';
export { CoarseTabs, type CoarseTabsProps, type CoarseTabItem, type CoarseTabVariant } from './components/layout/CoarseTabs';
export { PageProgress, type PageProgressProps } from './components/layout/PageProgress';

// ─────────────────────────────────────────────────────────────────────────────
// Components — navigation
// ─────────────────────────────────────────────────────────────────────────────
export { CommandPalette, type CommandPaletteProps, type CommandGroup, type CommandItem } from './components/navigation/CommandPalette';

// ─────────────────────────────────────────────────────────────────────────────
// Components — data-grid
// ─────────────────────────────────────────────────────────────────────────────
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

// Data-grid cell renderers
export { AvatarNameCell } from './components/data-grid/cell-renderers/AvatarNameCell';
export { StatusBadgeCell, createStatusBadgeCell, type StatusColors } from './components/data-grid/cell-renderers/StatusBadgeCell';
export { createRowActionsColumn, type RowAction, type RowActionsColumnOptions } from './components/data-grid/cell-renderers/RowActionsCell';
export type { CellRendererProps } from './components/data-grid/cell-renderers/types';

// Data-grid editorial shell + pieces
export { DataTable, type DataTableProps, type DataTableColumn } from './components/data-grid/DataTable';
export { DataGridShell, type DataGridShellProps } from './components/data-grid/DataGridShell';
export { BulkActionBar, type BulkActionBarProps, type BulkActionBarAction } from './components/data-grid/BulkActionBar';
export { Pagination, type PaginationProps } from './components/data-grid/Pagination';
export { FilterBar, type FilterBarProps, type FilterChip } from './components/data-grid/FilterBar';
export { FilterPopover, type FilterPopoverProps, type FilterPopoverOption } from './components/data-grid/FilterPopover';
export { ColumnChooser, type ColumnChooserProps, type ColumnChooserItem } from './components/data-grid/ColumnChooser';
export { ActiveFilterChips, type ActiveFilterChipsProps, type ActiveFilter } from './components/data-grid/ActiveFilterChips';

// ─────────────────────────────────────────────────────────────────────────────
// Components — kanban
// ─────────────────────────────────────────────────────────────────────────────
export { KanbanBoard } from './components/kanban/KanbanBoard';
export { KanbanColumn } from './components/kanban/KanbanColumn';
export { KanbanCard } from './components/kanban/KanbanCard';
export type {
  KanbanBoardProps,
  KanbanColumnDef,
  KanbanCardData,
  KanbanCardMoveEvent,
  KanbanColumnReorderEvent,
} from './components/kanban/types';

// ─────────────────────────────────────────────────────────────────────────────
// Components — sortable primitives
// ─────────────────────────────────────────────────────────────────────────────
export { Sortable } from './components/sortable/Sortable';
export { SortableItem, SortableHandle } from './components/sortable/SortableItem';

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────
export { useDebounce } from './hooks/useDebounce';
export { useDataGridParams } from './hooks/useDataGridParams';
export { useActiveFilters } from './hooks/useActiveFilters';
export { useAsyncValidator } from './hooks/useAsyncValidator';
export { useSlidingHighlight, type SlidingHighlightResult } from './hooks/useSlidingHighlight';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
export { cn } from './lib/utils';

// Re-export TanStack Table types for column definitions
export { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
