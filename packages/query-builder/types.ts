/** All supported filter operators */
export type FilterOperator =
  | 'eq'        // equals
  | 'neq'       // not equals
  | 'gt'        // greater than
  | 'gte'       // greater than or equal
  | 'lt'        // less than
  | 'lte'       // less than or equal
  | 'like'      // case-insensitive contains (ILIKE)
  | 'in'        // value in array
  | 'notIn'     // value not in array
  | 'isNull'    // IS NULL
  | 'isNotNull' // IS NOT NULL
  | 'between'   // BETWEEN (value is [min, max])
  | 'contains'; // JSON array containment (for multi_select)

/** A single filter expression: field + operator + value */
export interface FilterExpression {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Pagination params */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Computed pagination values */
export interface PaginationResult {
  offset: number;
  limit: number;
  page: number;
}

/** Pagination metadata for responses */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Column resolution map: field key → Drizzle column reference */
export type ColumnMap = Record<string, any>;

/** Valid operators per field type — used by frontend to render operator pickers */
export const OPERATORS_BY_FIELD_TYPE: Record<string, FilterOperator[]> = {
  text:         ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  email:        ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  phone:        ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  url:          ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  number:       ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  currency:     ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  decimal:      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  date:         ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  datetime:     ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  boolean:      ['eq', 'isNull', 'isNotNull'],
  picklist:     ['eq', 'neq', 'in', 'isNull', 'isNotNull'],
  multi_select: ['contains', 'eq', 'isNull', 'isNotNull'],
  lookup:       ['eq', 'neq', 'in', 'isNull', 'isNotNull'],
  user:         ['eq', 'neq', 'in', 'isNull', 'isNotNull'],
  multi_user:   ['contains', 'isNull', 'isNotNull'],
  multi_lookup: ['contains', 'isNull', 'isNotNull'],
  tags:         ['contains', 'isNull', 'isNotNull'],
  category:     ['eq', 'in', 'isNull', 'isNotNull'],
  workflow:     ['eq', 'neq', 'in'],
  auto_number:  ['eq', 'like'],
};

/** Query params that are system-level, not field filters */
export const SYSTEM_QUERY_PARAMS = new Set([
  'page', 'limit', 'search', 'sort', 'order', 'includeDeleted', 'filters',
]);

/** Human-readable label for each operator */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq:        'is',
  neq:       'is not',
  gt:        'greater than',
  gte:       'greater than or equal',
  lt:        'less than',
  lte:       'less than or equal',
  like:      'contains',
  in:        'is any of',
  notIn:     'is none of',
  isNull:    'is empty',
  isNotNull: 'is not empty',
  between:   'is between',
  contains:  'includes',
};
