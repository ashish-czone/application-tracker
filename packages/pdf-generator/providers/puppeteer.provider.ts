import type { PdfProvider, PdfOptions } from '../types';

/**
 * Puppeteer-based PDF provider.
 * Requires `puppeteer` as a peer dependency in the consuming app.
 *
 * Usage:
 *   import { PuppeteerPdfProvider } from '@packages/pdf-generator/providers/puppeteer.provider';
 *   PdfGeneratorModule.register({ provider: new PuppeteerPdfProvider() })
 */
export class PuppeteerPdfProvider implements PdfProvider {
  private readonly executablePath?: string;

  /**
   * @param executablePath — optional path to Chrome/Chromium executable.
   *   If omitted, Puppeteer uses its bundled Chromium.
   */
  constructor(executablePath?: string) {
    this.executablePath = executablePath;
  }

  async generatePdf(html: string, options?: PdfOptions): Promise<Buffer> {
    // Dynamic import so the package doesn't fail if puppeteer isn't installed
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(this.executablePath ? { executablePath: this.executablePath } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: options?.format ?? 'A4',
        landscape: options?.landscape ?? false,
        printBackground: options?.printBackground ?? true,
        margin: options?.margin ?? { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: !!(options?.headerHtml || options?.footerHtml),
        headerTemplate: options?.headerHtml ?? '',
        footerTemplate: options?.footerHtml ?? '',
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
