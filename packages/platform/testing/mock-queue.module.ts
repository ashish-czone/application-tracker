import { Global, Module } from '@nestjs/common';
import { QueueService } from '@packages/queue';

/**
 * Mock QueueService that avoids Redis dependency in integration tests.
 * Provides a no-op QueueService — registerProcessor is a no-op and getQueue returns null.
 */
@Global()
@Module({
  providers: [
    {
      provide: QueueService,
      useValue: {
        registerProcessor: () => {},
        getQueue: () => null,
      },
    },
  ],
  exports: [QueueService],
})
export class MockQueueModule {}
