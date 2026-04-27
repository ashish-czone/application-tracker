import { DocumentTemplatesModule } from './document-templates.module';
import type { DocumentTemplatesModuleOptions } from './types';

export { DocumentTemplatesModule };

/**
 * Configurable addon — pass options (e.g. a custom pdfRenderer) or call
 * with no args for defaults.
 */
export function documentTemplatesAddon(opts?: DocumentTemplatesModuleOptions) {
  return {
    module: DocumentTemplatesModule.register(opts),
    migration: '@packages/document-templates',
  } as const;
}
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
