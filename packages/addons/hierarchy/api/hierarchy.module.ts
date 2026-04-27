import { Module } from '@nestjs/common';
import { HierarchyService } from './services/hierarchy.service';

@Module({
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}