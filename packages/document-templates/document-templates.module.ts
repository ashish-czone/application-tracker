import { Module, type DynamicModule } from '@nestjs/common';
import { DocumentTemplatesService } from './services/document-templates.service';
import { TemplateProviderRegistry } from './services/template-provider-registry';
import { DocumentTemplatesController } from './controllers/document-templates.controller';
import type { DocumentTemplatesModuleOptions } from './types';

@Module({})
export class DocumentTemplatesModule {
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
}
