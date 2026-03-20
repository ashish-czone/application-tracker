import { Module } from '@nestjs/common';
import { CandidatesService } from './services/candidates.service';

@Module({
  providers: [CandidatesService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
