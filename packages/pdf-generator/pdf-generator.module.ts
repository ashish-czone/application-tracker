import { Module, type DynamicModule } from '@nestjs/common';
import { PdfGeneratorService, PDF_PROVIDER_TOKEN } from './services/pdf-generator.service';
import type { PdfGeneratorModuleOptions } from './types';

@Module({})
export class PdfGeneratorModule {
  static register(options: PdfGeneratorModuleOptions): DynamicModule {
    return {
      module: PdfGeneratorModule,
      providers: [
        { provide: PDF_PROVIDER_TOKEN, useValue: options.provider },
        PdfGeneratorService,
      ],
      exports: [PdfGeneratorService],
      global: true,
    };
  }
}
