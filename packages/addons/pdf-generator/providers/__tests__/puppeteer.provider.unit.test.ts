import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock puppeteer before importing the provider
const mockPage = {
  setContent: vi.fn().mockResolvedValue(undefined),
  pdf: vi.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

vi.mock('puppeteer', () => ({
  default: { launch: mockLaunch },
  launch: mockLaunch,
}));

import { PuppeteerPdfProvider } from '../puppeteer.provider';

describe('PuppeteerPdfProvider', () => {
  let provider: PuppeteerPdfProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PuppeteerPdfProvider();
  });

  afterEach(async () => {
    await provider.dispose();
  });

  describe('generatePdf', () => {
    it('should generate a PDF from HTML', async () => {
      const html = '<html><body>Hello</body></html>';
      const result = await provider.generatePdf(html);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalledWith(html, { waitUntil: 'networkidle0' });
      expect(mockPage.pdf).toHaveBeenCalled();
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should use default A4 format', async () => {
      await provider.generatePdf('<html></html>');

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'A4' }),
      );
    });

    it('should use provided format', async () => {
      await provider.generatePdf('<html></html>', { format: 'Letter' });

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'Letter' }),
      );
    });

    it('should default landscape to false', async () => {
      await provider.generatePdf('<html></html>');

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ landscape: false }),
      );
    });

    it('should pass landscape option', async () => {
      await provider.generatePdf('<html></html>', { landscape: true });

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ landscape: true }),
      );
    });

    it('should default printBackground to true', async () => {
      await provider.generatePdf('<html></html>');

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ printBackground: true }),
      );
    });

    it('should use default margins', async () => {
      await provider.generatePdf('<html></html>');

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        }),
      );
    });

    it('should pass custom margins', async () => {
      const margin = { top: '10mm', bottom: '10mm' };
      await provider.generatePdf('<html></html>', { margin });

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ margin }),
      );
    });

    it('should enable header/footer when headerHtml provided', async () => {
      await provider.generatePdf('<html></html>', { headerHtml: '<div>Header</div>' });

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          displayHeaderFooter: true,
          headerTemplate: '<div>Header</div>',
        }),
      );
    });

    it('should enable header/footer when footerHtml provided', async () => {
      await provider.generatePdf('<html></html>', { footerHtml: '<div>Footer</div>' });

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          displayHeaderFooter: true,
          footerTemplate: '<div>Footer</div>',
        }),
      );
    });

    it('should disable header/footer when neither provided', async () => {
      await provider.generatePdf('<html></html>');

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ displayHeaderFooter: false }),
      );
    });

    it('should close page even if pdf generation fails', async () => {
      mockPage.pdf.mockRejectedValueOnce(new Error('PDF failed'));

      await expect(provider.generatePdf('<html></html>')).rejects.toThrow('PDF failed');
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should reuse browser instance across calls', async () => {
      await provider.generatePdf('<html>1</html>');
      await provider.generatePdf('<html>2</html>');

      // Browser should only be launched once
      expect(mockLaunch).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('should close the browser', async () => {
      // Trigger browser creation
      await provider.generatePdf('<html></html>');

      await provider.dispose();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should be safe to call when no browser was created', async () => {
      // Don't generate any PDF - browser was never created
      const freshProvider = new PuppeteerPdfProvider();
      await expect(freshProvider.dispose()).resolves.not.toThrow();
    });
  });

  describe('constructor', () => {
    it('should accept custom executablePath', async () => {
      const customProvider = new PuppeteerPdfProvider('/usr/bin/chromium');

      await customProvider.generatePdf('<html></html>');

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({ executablePath: '/usr/bin/chromium' }),
      );

      await customProvider.dispose();
    });
  });
});
