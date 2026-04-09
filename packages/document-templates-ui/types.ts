export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  subject: string | null;
  htmlBody: string;
  isDefault: boolean;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceholderDefinition {
  key: string;
  label: string;
  sampleValue?: string;
}

export interface TemplateCategory {
  category: string;
  placeholders: PlaceholderDefinition[];
}

export interface RenderResult {
  html: string;
  subject: string | null;
}
