#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config';

async function main(): Promise<void> {
  loadConfig();

  const server = new McpServer({
    name: 'projects-mcp',
    version: '0.0.1',
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`projects-mcp: fatal: ${message}\n`);
  process.exit(1);
});
