import { Module, type DynamicModule, Inject, type OnModuleDestroy } from '@nestjs/common';
import { PdfGeneratorService, PDF_PROVIDER_TOKEN } from './services/pdf-generator.service';
import type { PdfGeneratorModuleOptions, PdfProvider } from './types';

@Module({})
export class PdfGeneratorModule implements OnModuleDestroy {
  constructor(@Inject(PDF_PROVIDER_TOKEN) private readonly provider: PdfProvider) {}

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

  async onModuleDestroy(): Promise<void> {
    await this.provider.dispose?.();
  }
}
