import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfGeneratorService, PDF_PROVIDER_TOKEN } from '../pdf-generator.service';
import type { PdfProvider, PdfOptions } from '../../types';

function createMockProvider(): PdfProvider {
  return {
    generatePdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockLogger() {
  const contextLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    forContext: vi.fn().mockReturnValue(contextLogger),
    _ctx: contextLogger,
  };
}

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;
  let provider: ReturnType<typeof createMockProvider>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    provider = createMockProvider();
    logger = createMockLogger();
    service = new PdfGeneratorService(provider, logger as any);
  });

  describe('generatePdf', () => {
    it('should delegate to the provider', async () => {
      const html = '<html><body>Hello</body></html>';
      const pdfBuffer = Buffer.from('pdf-content');
      (provider.generatePdf as any).mockResolvedValueOnce(pdfBuffer);

      const result = await service.generatePdf(html);

      expect(result).toBe(pdfBuffer);
      expect(provider.generatePdf).toHaveBeenCalledWith(html, undefined);
    });

    it('should pass options to the provider', async () => {
      const html = '<html></html>';
      const options: PdfOptions = { format: 'Letter', landscape: true };
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('pdf'));

      await service.generatePdf(html, options);

      expect(provider.generatePdf).toHaveBeenCalledWith(html, options);
    });

    it('should log before and after generation', async () => {
      const html = '<html>12345</html>';
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('ab'));

      await service.generatePdf(html);

      expect(logger._ctx.log).toHaveBeenCalledTimes(2);
      // First log: start with htmlLength
      expect(logger._ctx.log).toHaveBeenCalledWith(
        'Generating PDF',
        expect.objectContaining({ htmlLength: html.length }),
      );
      // Second log: done with sizeBytes
      expect(logger._ctx.log).toHaveBeenCalledWith(
        'PDF generated',
        expect.objectContaining({ sizeBytes: 2 }),
      );
    });

    it('should return the buffer from the provider', async () => {
      const expected = Buffer.from('real-pdf-bytes');
      (provider.generatePdf as any).mockResolvedValueOnce(expected);

      const result = await service.generatePdf('<html></html>');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toBe(expected);
    });

    it('should log default A4 format when no options provided', async () => {
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('x'));

      await service.generatePdf('<html></html>');

      expect(logger._ctx.log).toHaveBeenCalledWith(
        'Generating PDF',
        expect.objectContaining({ format: 'A4' }),
      );
    });

    it('should log provided format', async () => {
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('x'));

      await service.generatePdf('<html></html>', { format: 'Letter' });

      expect(logger._ctx.log).toHaveBeenCalledWith(
        'Generating PDF',
        expect.objectContaining({ format: 'Letter' }),
      );
    });
  });

  describe('generatePdfFromFragment', () => {
    it('should wrap fragment in HTML document and generate', async () => {
      const fragment = '<h1>Title</h1><p>Body</p>';
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('pdf'));

      await service.generatePdfFromFragment(fragment);

      const call = (provider.generatePdf as any).mock.calls[0];
      const fullHtml = call[0] as string;
      expect(fullHtml).toContain('<!DOCTYPE html>');
      expect(fullHtml).toContain('<html>');
      expect(fullHtml).toContain('<head>');
      expect(fullHtml).toContain('<meta charset="utf-8">');
      expect(fullHtml).toContain('<body><h1>Title</h1><p>Body</p></body>');
    });

    it('should pass options through to generatePdf', async () => {
      const options: PdfOptions = { landscape: true, format: 'Letter' };
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('pdf'));

      await service.generatePdfFromFragment('<p>Test</p>', options);

      const call = (provider.generatePdf as any).mock.calls[0];
      expect(call[1]).toEqual(options);
    });

    it('should include default styles in the wrapper', async () => {
      (provider.generatePdf as any).mockResolvedValueOnce(Buffer.from('pdf'));

      await service.generatePdfFromFragment('<p>Styled</p>');

      const call = (provider.generatePdf as any).mock.calls[0];
      const fullHtml = call[0] as string;
      expect(fullHtml).toContain('<style>');
      expect(fullHtml).toContain('font-family');
      expect(fullHtml).toContain('border-collapse');
    });

    it('should return the buffer from generatePdf', async () => {
      const pdfBuffer = Buffer.from('result-pdf');
      (provider.generatePdf as any).mockResolvedValueOnce(pdfBuffer);

      const result = await service.generatePdfFromFragment('<p>Hi</p>');

      expect(result).toBe(pdfBuffer);
    });
  });
});
