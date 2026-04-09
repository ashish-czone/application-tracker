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
    this.rbacService.registerPermissions('document-templates', [
      { action: 'read', description: 'View document templates' },
      { action: 'create', description: 'Create document templates' },
      { action: 'update', description: 'Update document templates' },
      { action: 'delete', description: 'Delete document templates' },
    ]);
  }
}
