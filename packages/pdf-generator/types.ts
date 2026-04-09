export interface PdfOptions {
  /** Page format */
  format?: 'A4' | 'Letter';
  /** Landscape orientation */
  landscape?: boolean;
  /** Page margins */
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  /** HTML header rendered on every page */
  headerHtml?: string;
  /** HTML footer rendered on every page */
  footerHtml?: string;
  /** Print background graphics and colors */
  printBackground?: boolean;
}

/**
 * PDF generation provider. Implement this interface to plug in
 * a specific PDF engine (Puppeteer, cloud API, wkhtmltopdf, etc.).
 */
export interface PdfProvider {
  generatePdf(html: string, options?: PdfOptions): Promise<Buffer>;
  /** Clean up resources (e.g. close browser). Called on module destroy. */
  dispose?(): Promise<void>;
}

export interface PdfGeneratorModuleOptions {
  /** The PDF provider implementation to use */
  provider: PdfProvider;
}
