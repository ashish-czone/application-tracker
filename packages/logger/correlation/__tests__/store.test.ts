import { describe, it, expect } from 'vitest';
import { runWithCorrelationId, getCorrelationId } from '../store';

describe('Correlation Store', () => {
  it('should return correlation ID within a context', () => {
    runWithCorrelationId('test-123', () => {
      expect(getCorrelationId()).toBe('test-123');
    });
  });

  it('should generate a new UUID outside of any context', () => {
    const id = getCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('should isolate correlation IDs between nested contexts', () => {
    runWithCorrelationId('outer', () => {
      expect(getCorrelationId()).toBe('outer');

      runWithCorrelationId('inner', () => {
        expect(getCorrelationId()).toBe('inner');
      });

      expect(getCorrelationId()).toBe('outer');
    });
  });

  it('should isolate correlation IDs between concurrent contexts', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        runWithCorrelationId('req-1', async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(getCorrelationId());
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        runWithCorrelationId('req-2', async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getCorrelationId());
          resolve();
        });
      }),
    ]);

    expect(results).toContain('req-1');
    expect(results).toContain('req-2');
  });
});
