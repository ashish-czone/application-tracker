import { Global, Module } from '@nestjs/common';
import { UniqueCheckService } from './services/unique-check.service';
import { UniqueCheckController } from './controllers/unique-check.controller';
import { EntityMetadataController } from './controllers/entity-metadata.controller';
import { CountriesSeedService } from './countries-seed.service';
import { TaxonomySeedService } from './taxonomy-seed.service';

@Global()
@Module({
  controllers: [UniqueCheckController, EntityMetadataController],
  providers: [UniqueCheckService, CountriesSeedService, TaxonomySeedService],
  exports: [UniqueCheckService],
})
export class SharedModule {}
