import { Global, Module } from '@nestjs/common';
import { OrderableService } from './services/orderable.service';

@Global()
@Module({
  providers: [OrderableService],
  exports: [OrderableService],
})
export class OrderableModule {}
