export { DocumentTemplatesModule } from './document-templates.module';
import type { DocumentTemplatesModuleOptions } from './types';

/**
 * Configurable addon — pass options (e.g. a custom pdfRenderer) or call
 * with no args for defaults. The module is loaded lazily so this export can
 * be imported by lightweight CLIs without pulling in NestJS decorators.
 */
export function documentTemplatesAddon(opts?: DocumentTemplatesModuleOptions) {
  return {
    module: () => require('./document-templates.module').DocumentTemplatesModule.register(opts),
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
