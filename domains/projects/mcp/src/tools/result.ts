import { ApiError } from '../apiClient';

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function toErrorResult(error: unknown): ToolResult {
  const message =
    error instanceof ApiError
      ? `API ${error.status} ${error.statusText}: ${error.body}`
      : error instanceof Error
        ? error.message
        : String(error);
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
