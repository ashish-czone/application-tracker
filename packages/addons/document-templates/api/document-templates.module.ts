import { Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { DocumentTemplatesService } from './services/document-templates.service';
import { TemplateProviderRegistry } from './services/template-provider-registry';
import { DocumentTemplatesController } from './controllers/document-templates.controller';
import type { DocumentTemplatesModuleOptions } from './types';

@Module({})
export class DocumentTemplatesModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  static register(options?: DocumentTemplatesModuleOptions): DynamicModule {
    const providers: any[] = [
      DocumentTemplatesService,
      TemplateProviderRegistry,
    ];

    if (options?.pdfRenderer) {
      providers.push({
        provide: 'PDF_RENDERER',
        useValue: options.pdfRenderer,
      });
    }

    return {
      module: DocumentTemplatesModule,
      controllers: [DocumentTemplatesController],
      providers,
      exports: [DocumentTemplatesService, TemplateProviderRegistry],
      global: true,
    };
  }

  onModuleInit() {
    this.rbacService.registerManifests([
      { slug: 'document-templates.read',   module: 'document-templates', action: 'read',   label: 'View document templates',   description: 'View document templates',   supportedScopes: ['any'] },
      { slug: 'document-templates.create', module: 'document-templates', action: 'create', label: 'Create document templates', description: 'Create document templates', supportedScopes: ['any'] },
      { slug: 'document-templates.update', module: 'document-templates', action: 'update', label: 'Update document templates', description: 'Update document templates', supportedScopes: ['any'] },
      { slug: 'document-templates.delete', module: 'document-templates', action: 'delete', label: 'Delete document templates', description: 'Delete document templates', supportedScopes: ['any'] },
    ]);
  }
}
