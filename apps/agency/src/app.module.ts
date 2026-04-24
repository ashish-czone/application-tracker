import { Module } from '@nestjs/common';
import path from 'path';
import { createAppModule } from '@packages/app-shell';
import { agencyBackend } from '@domains/agency-api';
import { UsersModule } from './modules/users/users.module';

@Module(
  createAppModule({
    domains: [agencyBackend],
    appName: 'agency',
    envFilePath: path.resolve(__dirname, '../.env'),
    extraImports: [UsersModule],
  }),
)
export class AppModule {}
