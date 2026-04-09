import { Injectable, Inject } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { PdfProvider, PdfOptions } from '../types';

export const PDF_PROVIDER_TOKEN = 'PDF_PROVIDER';

@Injectable()
export class PdfGeneratorService {
  private readonly logger: ContextLogger;

  constructor(
    @Inject(PDF_PROVIDER_TOKEN) private readonly provider: PdfProvider,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(PdfGeneratorService.name);
  }

  /**
   * Generate a PDF from an HTML string.
   * Delegates to the configured PdfProvider implementation.
   */
  async generatePdf(html: string, options?: PdfOptions): Promise<Buffer> {
    this.logger.log('Generating PDF', { htmlLength: html.length, format: options?.format ?? 'A4' });
    const buffer = await this.provider.generatePdf(html, options);
    this.logger.log('PDF generated', { sizeBytes: buffer.length });
    return buffer;
  }

  /**
   * Convenience: wraps HTML in a basic document structure before generating.
   * Useful when the input is a body fragment without <html>/<head> tags.
   */
  async generatePdfFromFragment(bodyHtml: string, options?: PdfOptions): Promise<Buffer> {
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; padding: 40px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    p { margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
    return this.generatePdf(fullHtml, options);
  }
}
