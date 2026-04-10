// ---------------------------------------------------------------------------
// Template entity
// ---------------------------------------------------------------------------

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  subject: string | null;
  htmlBody: string;
  isDefault: boolean;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Placeholder provider — consumers implement this
// ---------------------------------------------------------------------------

export interface PlaceholderDefinition {
  /** Placeholder key used in template body, e.g. "candidateFirstName" */
  key: string;
  /** Human-readable label, e.g. "Candidate First Name" */
  label: string;
  /** Sample value for preview rendering, e.g. "John" */
  sampleValue?: string;
}

export interface TemplatePlaceholderProvider {
  /** Template category this provider handles, e.g. "offer-letter" */
  category: string;
  /** Available placeholders for this category */
  getPlaceholders(): PlaceholderDefinition[];
  /** Resolve placeholder values for a given context (e.g. offerId) */
  resolve(contextId: string): Promise<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// PDF renderer — pluggable strategy
// ---------------------------------------------------------------------------

export interface PdfRenderer {
  htmlToPdf(html: string, options?: PdfRenderOptions): Promise<Buffer>;
}

export interface PdfRenderOptions {
  format?: 'A4' | 'Letter';
  landscape?: boolean;
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
}

// ---------------------------------------------------------------------------
// Module options
// ---------------------------------------------------------------------------

export interface DocumentTemplatesModuleOptions {
  pdfRenderer?: PdfRenderer;
}

// ---------------------------------------------------------------------------
// Render result
// ---------------------------------------------------------------------------

export interface RenderResult {
  html: string;
  subject: string | null;
}
