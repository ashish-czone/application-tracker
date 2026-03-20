import { Global, Module } from '@nestjs/common';
import { HierarchyService } from './services/hierarchy.service';

@Global()
@Module({
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}