import { Global, Module } from '@nestjs/common';
import { LayoutService } from './services/layout.service';
import { LayoutsController } from './controllers/layouts.controller';

@Global()
@Module({
  controllers: [LayoutsController],
  providers: [LayoutService],
  exports: [LayoutService],
})
export class EntityLayoutModule {}
