import type { PdfProvider, PdfOptions } from '../types';

/**
 * Puppeteer-based PDF provider.
 * Requires `puppeteer` as a peer dependency in the consuming app.
 *
 * Reuses a single browser instance across calls for performance.
 * Call `dispose()` during app shutdown to close the browser.
 *
 * Usage:
 *   import { PuppeteerPdfProvider } from '@packages/pdf-generator/providers/puppeteer.provider';
 *   PdfGeneratorModule.register({ provider: new PuppeteerPdfProvider() })
 */
export class PuppeteerPdfProvider implements PdfProvider {
  private readonly executablePath?: string;
  private browserPromise: Promise<import('puppeteer').Browser> | null = null;

  /**
   * @param executablePath — optional path to Chrome/Chromium executable.
   *   If omitted, Puppeteer uses its bundled Chromium.
   */
  constructor(executablePath?: string) {
    this.executablePath = executablePath;
  }

  private getBrowser(): Promise<import('puppeteer').Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.launchBrowser();
    }
    return this.browserPromise;
  }

  private async launchBrowser(): Promise<import('puppeteer').Browser> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(this.executablePath ? { executablePath: this.executablePath } : {}),
    });

    browser.on('disconnected', () => {
      this.browserPromise = null;
    });

    return browser;
  }

  async generatePdf(html: string, options?: PdfOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
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
      await page.close();
    }
  }

  async dispose(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      this.browserPromise = null;
      await browser.close();
    }
  }
}
