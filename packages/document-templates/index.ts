export { DocumentTemplatesModule } from './document-templates.module';
export { DocumentTemplatesService } from './services/document-templates.service';
export { TemplateProviderRegistry } from './services/template-provider-registry';
export { documentTemplates } from './schema';
export { DOCUMENT_TEMPLATES_PERMISSIONS } from './permissions';
export type {
  DocumentTemplate,
  PlaceholderDefinition,
  TemplatePlaceholderProvider,
  PdfRenderer,
  PdfRenderOptions,
  DocumentTemplatesModuleOptions,
  RenderResult,
} from './types';
