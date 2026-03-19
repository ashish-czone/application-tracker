import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { runWithCorrelationId } from './store';

const HEADER_NAME = 'x-correlation-id';

/**
 * Express middleware that establishes a correlation ID context for each request.
 * - Reads an existing X-Correlation-Id header if provided (e.g., from an API gateway)
 * - Otherwise generates a new UUID
 * - Sets the correlation ID on the response header
 * - Wraps the rest of the request in AsyncLocalStorage so getCorrelationId() works everywhere
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers[HEADER_NAME] as string) || randomUUID();
  res.setHeader('X-Correlation-Id', correlationId);
  runWithCorrelationId(correlationId, () => next());
}
