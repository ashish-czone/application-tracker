import { Global, Module } from '@nestjs/common';
import { TaxonomyService } from './services/taxonomy.service';
import { CategoryService } from './services/category.service';

@Global()
@Module({
  providers: [TaxonomyService, CategoryService],
  exports: [TaxonomyService, CategoryService],
})
export class TaxonomyModule {}
