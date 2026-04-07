import { Global, Module } from '@nestjs/common';
import { DraftsService } from './services/drafts.service';
import { DraftsController } from './controllers/drafts.controller';

@Global()
@Module({
  controllers: [DraftsController],
  providers: [DraftsService],
  exports: [DraftsService],
})
export class DraftsModule {}
