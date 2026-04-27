import { Module } from '@nestjs/common';
import { OrderableService } from './services/orderable.service';

@Module({
  providers: [OrderableService],
  exports: [OrderableService],
})
export class OrderableModule {}
