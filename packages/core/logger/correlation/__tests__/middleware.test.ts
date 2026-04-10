import { describe, it, expect, vi } from 'vitest';
import { correlationIdMiddleware } from '../middleware';
import { getCorrelationId } from '../store';

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as any;
  const res = { setHeader: vi.fn() } as any;
  return { req, res };
}

describe('correlationIdMiddleware', () => {
  it('should generate a correlation ID when none is provided', () => {
    const { req, res } = createMockReqRes();
    let capturedId = '';

    correlationIdMiddleware(req, res, () => {
      capturedId = getCorrelationId();
    });

    expect(capturedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', capturedId);
  });

  it('should use the X-Correlation-Id header when provided', () => {
    const { req, res } = createMockReqRes({ 'x-correlation-id': 'from-gateway' });
    let capturedId = '';

    correlationIdMiddleware(req, res, () => {
      capturedId = getCorrelationId();
    });

    expect(capturedId).toBe('from-gateway');
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'from-gateway');
  });

  it('should set the correlation ID on the response header', () => {
    const { req, res } = createMockReqRes();

    correlationIdMiddleware(req, res, () => {});

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      expect.any(String),
    );
  });
});
