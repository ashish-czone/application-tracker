import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsBoolean, IsObject, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ConditionDto {
  @IsString()
  @MaxLength(100)
  field!: string;

  @IsString()
  @IsIn(['eq', 'neq', 'in', 'gt', 'lt', 'is_null', 'is_not_null', 'changed', 'changed_to', 'changed_from_to'])
  operator!: string;

  @IsOptional()
  value?: unknown;
}

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: 'Updated rule name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'actor', enum: ['actor', 'entity_owner', 'role'] })
  @IsOptional()
  @IsString()
  @IsIn(['actor', 'entity_owner', 'role'])
  recipientStrategy?: string;

  @ApiPropertyOptional({ example: { roleId: '...' } })
  @IsOptional()
  @IsObject()
  recipientConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @ApiPropertyOptional({ example: [1, 3, 5], description: 'Days of week to run (0=Sun, 1=Mon, ..., 6=Sat)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDaysOfWeek?: number[];
}
