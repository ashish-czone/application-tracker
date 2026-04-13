import { IsOptional, IsString, IsInt, Min, Max, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListExecutionsQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by rule ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ruleId?: string;

  @ApiPropertyOptional({ enum: ['success', 'error'], description: 'Filter by execution status' })
  @IsOptional()
  @IsIn(['success', 'error'])
  status?: 'success' | 'error';

  @ApiPropertyOptional({ description: 'Filter by entity type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by action type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionType?: string;

  @ApiPropertyOptional({ enum: ['executedAt'], default: 'executedAt' })
  @IsOptional()
  @IsIn(['executedAt'])
  sort?: 'executedAt' = 'executedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
