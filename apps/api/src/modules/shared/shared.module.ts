import { Global, Module } from '@nestjs/common';
import { EavAttributesModule } from '@packages/eav-attributes';
import { UniqueCheckService } from './services/unique-check.service';
import { UniqueCheckController } from './controllers/unique-check.controller';
import { EntityMetadataController } from './controllers/entity-metadata.controller';

@Global()
@Module({
  imports: [EavAttributesModule],
  controllers: [UniqueCheckController, EntityMetadataController],
  providers: [UniqueCheckService],
  exports: [UniqueCheckService],
})
export class SharedModule {}
