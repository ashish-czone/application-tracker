/**
 * Filter types and constants for the DataGrid filter builder.
 * Mirrors @packages/query-builder/types.ts to keep @packages/ui self-contained.
 */

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
  /** Display label for the value (used in chips, not sent to API) */
  displayValue?: string;
}

/** Valid operators per field type */
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
