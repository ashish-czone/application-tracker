import { Global, Module } from '@nestjs/common';
import { UniqueCheckService } from './services/unique-check.service';
import { UniqueCheckController } from './controllers/unique-check.controller';
import { EntityMetadataController } from './controllers/entity-metadata.controller';
import { OrgUnitsSeedService } from './org-units-seed.service';

@Global()
@Module({
  controllers: [UniqueCheckController, EntityMetadataController],
  providers: [UniqueCheckService, OrgUnitsSeedService],
  exports: [UniqueCheckService],
})
export class SharedModule {}
