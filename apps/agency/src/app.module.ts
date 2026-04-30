import { Module } from '@nestjs/common';
import path from 'path';
import { createAppModule } from '@packages/app-shell';
import { OrderableModule } from '@packages/orderable';
import { agencyBackend } from '@domains/agency-api';
import { marketingBackend } from '@domains/marketing-api';
import { projectsBackend } from '@domains/projects-api';
import { agencyAddons } from './addons';
import { UsersModule } from './modules/users/users.module';
import { TestHooksModule } from './modules/test-hooks/test-hooks.module';

@Module(
  createAppModule({
    domains: [agencyBackend, marketingBackend, projectsBackend],
    appName: 'agency',
    envFilePath: path.resolve(__dirname, '../.env'),
    addons: agencyAddons,
    extraImports: [
      UsersModule,
      OrderableModule,
      TestHooksModule.register(),
    ],
  }),
)
export class AppModule {}
