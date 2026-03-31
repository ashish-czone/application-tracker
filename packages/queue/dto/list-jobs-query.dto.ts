import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListJobsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by job status', enum: ['waiting', 'active', 'completed', 'failed', 'delayed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Offset for pagination', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start?: number = 0;

  @ApiPropertyOptional({ description: 'Number of jobs to return', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class CleanJobsDto {
  @ApiPropertyOptional({ description: 'Job status to clean', enum: ['completed', 'failed'] })
  @IsString()
  status!: string;

  @ApiPropertyOptional({ description: 'Grace period in milliseconds', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  grace?: number = 0;
}
