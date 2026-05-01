import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import { createAppModule } from '@packages/app-shell';
import { WorkflowsEntityEngineModule } from '@packages/workflows-entity-engine';
import { TaxonomyEntityEngineModule } from '@packages/taxonomy-entity-engine';
import { ServiceAuthModule } from '@packages/service-auth';
import { OAuthModule } from '@packages/oauth';
import { PdfGeneratorModule } from '@packages/pdf-generator';
import { PuppeteerPdfProvider } from '@packages/pdf-generator/providers/puppeteer.provider';
import { complianceBackend } from '@domains/compliance-api';
import { complianceAddons } from './addons';
import { OrgUnitsModule } from './modules/org-units/org-units.module';
import { UsersModule } from './modules/users/users.module';
import { TestHooksModule } from './modules/test-hooks/test-hooks.module';

const serviceAuthImports = process.env.TENANCY_MODE
  ? [
      ServiceAuthModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          serviceId: 'compliance-app',
          privateKey: config.get<string>('SERVICE_PRIVATE_KEY')!,
          trustedServices: JSON.parse(config.get<string>('TRUSTED_SERVICE_KEYS') || '{}'),
        }),
        inject: [ConfigService],
      }),
    ]
  : [];

@Module(
  createAppModule({
    domains: [complianceBackend],
    appName: 'compliance',
    envFilePath: path.resolve(__dirname, '../.env'),
    addons: complianceAddons,
    extraImports: [
      ...serviceAuthImports,
      WorkflowsEntityEngineModule,
      TaxonomyEntityEngineModule,
      UsersModule,
      OAuthModule.register(),
      OrgUnitsModule,
      PdfGeneratorModule.register({ provider: new PuppeteerPdfProvider() }),
      TestHooksModule.register(),
    ],
  }),
)
export class AppModule {}
