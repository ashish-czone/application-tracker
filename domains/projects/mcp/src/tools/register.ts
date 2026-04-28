import type { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

export type ToolRegistrar = (
  name: string,
  description: string,
  schema: z.ZodRawShape,
  handler: ToolHandler,
) => void;

// SDK overloads for `tool()` accumulate generics across calls and trip TS2589
// (excessively deep) once we register more than a couple of zod-shape tools.
// This wrapper hides the generic surface so each call types independently.
export function makeRegistrar(server: McpServer): ToolRegistrar {
  return (name, description, schema, handler) => {
    (server.tool as unknown as ToolRegistrar)(name, description, schema, handler);
  };
}
