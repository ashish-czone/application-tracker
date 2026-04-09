import { Injectable, NotFoundException, Inject, Optional } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { documentTemplates } from '../schema';
import { TemplateProviderRegistry } from './template-provider-registry';
import type { DocumentTemplate, RenderResult, PdfRenderer } from '../types';

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly providerRegistry: TemplateProviderRegistry,
    @Optional() @Inject('PDF_RENDERER') private readonly pdfRenderer?: PdfRenderer,
  ) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async list(category?: string): Promise<DocumentTemplate[]> {
    const query = this.database.db.select().from(documentTemplates);
    const rows = category
      ? await query.where(eq(documentTemplates.category, category))
      : await query;
    return rows as DocumentTemplate[];
  }

  async findById(id: string): Promise<DocumentTemplate> {
    const [template] = await this.database.db
      .select()
      .from(documentTemplates)
      .where(eq(documentTemplates.id, id));
    if (!template) throw new NotFoundException(`Template '${id}' not found`);
    return template as DocumentTemplate;
  }

  async findDefault(category: string): Promise<DocumentTemplate | null> {
    const [template] = await this.database.db
      .select()
      .from(documentTemplates)
      .where(and(
        eq(documentTemplates.category, category),
        eq(documentTemplates.isDefault, true),
      ));
    return (template as DocumentTemplate) ?? null;
  }

  async create(data: {
    name: string;
    category: string;
    subject?: string;
    htmlBody: string;
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
    createdBy: string;
  }): Promise<DocumentTemplate> {
    // If setting as default, unset any existing default for this category
    if (data.isDefault) {
      await this.database.db
        .update(documentTemplates)
        .set({ isDefault: false })
        .where(and(
          eq(documentTemplates.category, data.category),
          eq(documentTemplates.isDefault, true),
        ));
    }

    const [created] = await this.database.db
      .insert(documentTemplates)
      .values({
        name: data.name,
        category: data.category,
        subject: data.subject ?? null,
        htmlBody: data.htmlBody,
        isDefault: data.isDefault ?? false,
        metadata: data.metadata ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    return created as DocumentTemplate;
  }

  async update(id: string, data: {
    name?: string;
    subject?: string;
    htmlBody?: string;
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<DocumentTemplate> {
    const existing = await this.findById(id);

    // If setting as default, unset any existing default for this category
    if (data.isDefault) {
      await this.database.db
        .update(documentTemplates)
        .set({ isDefault: false })
        .where(and(
          eq(documentTemplates.category, existing.category),
          eq(documentTemplates.isDefault, true),
        ));
    }

    const [updated] = await this.database.db
      .update(documentTemplates)
      .set(data)
      .where(eq(documentTemplates.id, id))
      .returning();

    return updated as DocumentTemplate;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id); // Throws if not found
    await this.database.db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  async render(templateId: string, contextId: string): Promise<RenderResult> {
    const template = await this.findById(templateId);
    const provider = this.providerRegistry.get(template.category);
    if (!provider) {
      throw new NotFoundException(`No placeholder provider registered for category '${template.category}'`);
    }

    const values = await provider.resolve(contextId);
    const html = this.interpolate(template.htmlBody, values);
    const subject = template.subject ? this.interpolate(template.subject, values) : null;

    return { html, subject };
  }

  async renderPreview(templateId: string): Promise<RenderResult> {
    const template = await this.findById(templateId);
    const provider = this.providerRegistry.get(template.category);

    // Use sample values from placeholder definitions
    const values: Record<string, string> = {};
    if (provider) {
      for (const p of provider.getPlaceholders()) {
        values[p.key] = p.sampleValue ?? `[${p.label}]`;
      }
    }

    const html = this.interpolate(template.htmlBody, values);
    const subject = template.subject ? this.interpolate(template.subject, values) : null;

    return { html, subject };
  }

  async renderToPdf(templateId: string, contextId: string): Promise<Buffer> {
    if (!this.pdfRenderer) {
      throw new Error('PDF rendering not configured. Provide a PdfRenderer implementation.');
    }

    const { html } = await this.render(templateId, contextId);
    return this.pdfRenderer.htmlToPdf(html);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private interpolate(template: string, values: Record<string, string>): string {
    return template.replace(PLACEHOLDER_REGEX, (match, key: string) => {
      return key in values ? values[key] : match;
    });
  }
}
