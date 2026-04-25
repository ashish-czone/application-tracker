import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import { createAppModule } from '@packages/app-shell';
import { TenancyModule, type TenancyMode, type TenantResolver } from '@packages/tenancy';
import { ServiceAuthModule } from '@packages/service-auth';
import { AttachmentsModule } from '@packages/attachments';
import { DocumentTemplatesModule } from '@packages/document-templates';
import { EavAttributesModule } from '@packages/eav-attributes';
import { EntityRelationsModule } from '@packages/entity-relations';
import { EvaluationsModule } from '@packages/evaluations';
import { NotesModule } from '@packages/notes';
import { OAuthModule } from '@packages/oauth';
import { OrgUnitsModule } from '@packages/org-units';
import { PdfGeneratorModule } from '@packages/pdf-generator';
import { PuppeteerPdfProvider } from '@packages/pdf-generator/providers/puppeteer.provider';
import { TaxonomyModule } from '@packages/taxonomy';
import { recruitBackend } from '@domains/recruit-api';
import { UsersModule } from './modules/users/users.module';

const tenancyImports = process.env.TENANCY_MODE
  ? [
      TenancyModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          mode: config.get<string>('TENANCY_MODE') as TenancyMode,
          resolver: (config.get<string>('TENANCY_RESOLVER') ?? 'header') as TenantResolver,
          headerName: config.get<string>('TENANCY_HEADER'),
          controlPlaneUrl: config.get<string>('CONTROL_PLANE_URL'),
        }),
        inject: [ConfigService],
      }),
      ServiceAuthModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          serviceId: 'recruit-app',
          privateKey: config.get<string>('SERVICE_PRIVATE_KEY')!,
          trustedServices: JSON.parse(config.get<string>('TRUSTED_SERVICE_KEYS') || '{}'),
        }),
        inject: [ConfigService],
      }),
    ]
  : [];

@Module(
  createAppModule({
    domains: [recruitBackend],
    appName: 'recruit',
    envFilePath: path.resolve(__dirname, '../.env'),
    extraImports: [
      ...tenancyImports,
      UsersModule,
      AttachmentsModule,
      EavAttributesModule,
      EntityRelationsModule,
      EvaluationsModule,
      NotesModule,
      OAuthModule.register(),
      OrgUnitsModule,
      TaxonomyModule,
      DocumentTemplatesModule.register(),
      PdfGeneratorModule.register({ provider: new PuppeteerPdfProvider() }),
    ],
  }),
)
export class AppModule {}
