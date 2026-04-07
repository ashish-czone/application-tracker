import { IsOptional, IsString, IsInt, Min, Max, IsUUID, IsDateString, MaxLength, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Filter by entity type (e.g., tasks, users)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by event name (e.g., tasks.TaskCreated)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventName?: string;

  @ApiPropertyOptional({ description: 'Filter by action (e.g., created, updated, deleted)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @ApiPropertyOptional({ description: 'Filter from date (ISO format)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO format)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity type (for cross-entity events)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetEntityType?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity ID (for cross-entity events)' })
  @IsOptional()
  @IsUUID()
  targetEntityId?: string;

  @ApiPropertyOptional({ description: 'Include related cross-entity events (notes, evaluations, attachments)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  includeRelated?: boolean;
}
