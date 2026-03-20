import { Global, Module } from '@nestjs/common';
import { UniqueCheckService } from './services/unique-check.service';
import { UniqueCheckController } from './controllers/unique-check.controller';

@Global()
@Module({
  controllers: [UniqueCheckController],
  providers: [UniqueCheckService],
  exports: [UniqueCheckService],
})
export class SharedModule {}
