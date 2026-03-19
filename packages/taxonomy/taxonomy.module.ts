import { Global, Module } from '@nestjs/common';
import { TaxonomyService } from './services/taxonomy.service';

@Global()
@Module({
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
