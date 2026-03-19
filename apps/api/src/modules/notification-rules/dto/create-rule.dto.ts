import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsArray, ValidateNested, IsUUID, IsObject, IsInt, Min, Max, ValidateIf, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RuleChannelDto {
  @ApiProperty({ example: 'email', enum: ['email', 'in_app', 'whatsapp'] })
  @IsString()
  @IsIn(['email', 'in_app', 'whatsapp'])
  channel!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  templateId!: string;
}

class ConditionDto {
  @ApiProperty({ example: 'status' })
  @IsString()
  @MaxLength(100)
  field!: string;

  @ApiProperty({ example: 'eq', enum: ['eq', 'neq', 'in', 'gt', 'lt', 'is_null', 'is_not_null'] })
  @IsString()
  @IsIn(['eq', 'neq', 'in', 'gt', 'lt', 'is_null', 'is_not_null'])
  operator!: string;

  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  value?: unknown;
}

export class CreateRuleDto {
  @ApiProperty({ example: 'Welcome notification' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'event', enum: ['event', 'schedule_once', 'schedule_recurring'] })
  @IsString()
  @IsIn(['event', 'schedule_once', 'schedule_recurring'])
  triggerType!: string;

  // --- Event trigger fields (required when triggerType = 'event') ---

  @ApiPropertyOptional({ example: 'users.UserCreated' })
  @ValidateIf((o) => o.triggerType === 'event')
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  eventName?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  delayAmount?: number;

  @ApiPropertyOptional({ example: 'days', enum: ['minutes', 'hours', 'days'] })
  @IsOptional()
  @IsString()
  @IsIn(['minutes', 'hours', 'days'])
  delayUnit?: string;

  // --- Schedule trigger fields ---

  // Required for schedule_once and schedule_recurring
  @ApiPropertyOptional({ example: 'tasks' })
  @ValidateIf((o) => o.triggerType === 'schedule_once' || o.triggerType === 'schedule_recurring')
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scheduleEntityType?: string;

  // Required for schedule_once (must have a date anchor)
  @ApiPropertyOptional({ example: 'dueDate' })
  @ValidateIf((o) => o.triggerType === 'schedule_once')
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scheduleDateField?: string;

  @ApiPropertyOptional({ example: 'before', enum: ['before', 'after'] })
  @ValidateIf((o) => o.triggerType === 'schedule_once')
  @IsString()
  @IsIn(['before', 'after'])
  scheduleDateOperator?: string;

  @ApiPropertyOptional({ example: [7, 3, 1] })
  @ValidateIf((o) => o.triggerType === 'schedule_once')
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  scheduleDateAmounts?: number[];

  @ApiPropertyOptional({ example: 'days', enum: ['minutes', 'hours', 'days'] })
  @ValidateIf((o) => o.triggerType === 'schedule_once')
  @IsString()
  @IsIn(['minutes', 'hours', 'days'])
  scheduleDateUnit?: string;

  @ApiPropertyOptional({ example: [1, 3, 5], description: 'Days of week to run (0=Sun, 1=Mon, ..., 6=Sat). Recurring rules only.' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDaysOfWeek?: number[];

  // --- Shared ---

  @ApiPropertyOptional({ type: [ConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @ApiProperty({ example: 'actor', enum: ['actor', 'entity_owner', 'role'] })
  @IsString()
  @IsIn(['actor', 'entity_owner', 'role'])
  recipientStrategy!: string;

  @ApiPropertyOptional({ example: { roleId: '...' } })
  @IsOptional()
  @IsObject()
  recipientConfig?: Record<string, unknown>;

  @ApiProperty({ type: [RuleChannelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleChannelDto)
  channels!: RuleChannelDto[];
}
