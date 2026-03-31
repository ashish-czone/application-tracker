import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { QueueService } from '../services/queue.service';
import { ListJobsQueryDto, CleanJobsDto } from '../dto/list-jobs-query.dto';
import { QUEUE_PERMISSIONS } from '../permissions';
import type { Job } from 'bullmq';

function serializeJob(job: Job, status: string) {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    status,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason ?? null,
    stacktrace: job.stacktrace ?? [],
    progress: job.progress,
    returnvalue: job.returnvalue ?? null,
  };
}

@Controller('queues')
export class QueueDashboardController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  @RequirePermission(QUEUE_PERMISSIONS.READ)

  async listQueues() {
    const names = this.queueService.getQueueNames();
    const result = await Promise.all(
      names.map(async (name) => {
        const queue = this.queueService.getQueue(name)!;
        const [counts, isPaused] = await Promise.all([
          queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
          queue.isPaused(),
        ]);
        return { name, isPaused, counts };
      }),
    );
    return result;
  }

  @Get(':name/jobs')
  @RequirePermission(QUEUE_PERMISSIONS.READ)

  async listJobs(@Param('name') name: string, @Query() query: ListJobsQueryDto) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);

    const start = query.start ?? 0;
    const limit = query.limit ?? 25;
    const end = start + limit - 1;

    const statusFilter = query.status as any;
    const types = statusFilter ? [statusFilter] : ['waiting', 'active', 'completed', 'failed', 'delayed'];

    const jobs = await queue.getJobs(types, start, end, false);

    // Resolve states in parallel
    const states = await Promise.all(jobs.map((j) => j.getState()));
    const data = jobs.map((job, i) => serializeJob(job, states[i]));

    // Get total count for the filtered status
    const counts = await queue.getJobCounts(...(statusFilter ? [statusFilter] : ['waiting', 'active', 'completed', 'failed', 'delayed']));
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return { data, meta: { total, start, limit } };
  }

  @Post(':name/pause')
  @RequirePermission(QUEUE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)

  async pauseQueue(@Param('name') name: string) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
    await queue.pause();
  }

  @Post(':name/resume')
  @RequirePermission(QUEUE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)

  async resumeQueue(@Param('name') name: string) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
    await queue.resume();
  }

  @Post(':name/clean')
  @RequirePermission(QUEUE_PERMISSIONS.MANAGE)

  async cleanJobs(@Param('name') name: string, @Body() dto: CleanJobsDto) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
    const removed = await queue.clean(dto.grace ?? 0, 1000, dto.status as any);
    return { removed: removed.length };
  }

  @Post(':name/retry-all')
  @RequirePermission(QUEUE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)

  async retryAll(@Param('name') name: string) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
    await queue.retryJobs();
  }

  @Post(':name/jobs/:jobId/retry')
  @RequirePermission(QUEUE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)

  async retryJob(@Param('name') name: string, @Param('jobId') jobId: string) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job "${jobId}" not found`);
    await job.retry();
  }

  @Delete(':name/jobs/:jobId')
  @RequirePermission(QUEUE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)

  async removeJob(@Param('name') name: string, @Param('jobId') jobId: string) {
    const queue = this.queueService.getQueue(name);
    if (!queue) throw new NotFoundException(`Queue "${name}" not found`);
    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job "${jobId}" not found`);
    await job.remove();
  }
}
