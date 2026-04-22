import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsArray, ValidateNested, IsObject, IsInt, Min, Max, ValidateIf, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ConditionDto {
  @ApiProperty({ example: 'status' })
  @IsString()
  @MaxLength(100)
  field!: string;

  @ApiProperty({ example: 'eq', enum: ['eq', 'neq', 'in', 'gt', 'lt', 'is_null', 'is_not_null', 'changed', 'changed_to', 'changed_from_to'] })
  @IsString()
  @IsIn(['eq', 'neq', 'in', 'gt', 'lt', 'is_null', 'is_not_null', 'changed', 'changed_to', 'changed_from_to'])
  operator!: string;

  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  value?: unknown;
}

class UserResolutionDto {
  @ApiProperty({ example: 'actor', enum: ['actor', 'entity_field', 'role'] })
  @IsString()
  @IsIn(['actor', 'entity_field', 'role'])
  strategy!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

class ActionLinkDto {
  @ApiProperty({ example: 'follow_up_task' })
  @IsString()
  @MaxLength(100)
  as!: string;
}

class ActionConfigDto {
  @ApiProperty({ example: 'send_notification' })
  @IsString()
  @MaxLength(100)
  type!: string;

  @ApiProperty()
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  users?: Record<string, UserResolutionDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionLinkDto)
  link?: ActionLinkDto;
}

class LifecycleUpdateBindingDto {
  @ApiPropertyOptional({ type: [ConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @ApiProperty({ example: 'follow_up_task' })
  @IsString()
  linked!: string;

  @ApiProperty({ enum: ['update'] })
  @IsString()
  @IsIn(['update'])
  action!: 'update';

  @ApiProperty()
  @IsObject()
  set!: Record<string, unknown>;
}

class LifecycleDeleteBindingDto {
  @ApiProperty({ example: 'follow_up_task' })
  @IsString()
  linked!: string;

  @ApiProperty({ enum: ['update', 'delete'] })
  @IsString()
  @IsIn(['update', 'delete'])
  action!: 'update' | 'delete';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  set?: Record<string, unknown>;
}

export class CreateRuleDto {
  @ApiProperty({ example: 'Interview follow-up automation' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Creates a task when an interview is scheduled' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'event', enum: ['event', 'schedule_once', 'schedule_recurring'] })
  @IsString()
  @IsIn(['event', 'schedule_once', 'schedule_recurring'])
  triggerType!: string;

  // --- Event trigger fields ---

  @ApiPropertyOptional({ example: 'interviews.InterviewScheduled' })
  @ValidateIf((o) => o.triggerType === 'event')
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  eventName?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  delayAmount?: number;

  @ApiPropertyOptional({ example: 'minutes', enum: ['minutes', 'hours', 'days'] })
  @IsOptional()
  @IsString()
  @IsIn(['minutes', 'hours', 'days'])
  delayUnit?: string;

  // --- Schedule trigger fields ---

  @ApiPropertyOptional({ example: 'tasks' })
  @ValidateIf((o) => o.triggerType === 'schedule_once' || o.triggerType === 'schedule_recurring')
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scheduleEntityType?: string;

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

  @ApiPropertyOptional({ example: [1, 3, 5] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDaysOfWeek?: number[];

  @ApiPropertyOptional({ example: 9, description: 'Hour 0-23 in APP_TIMEZONE at which the rule fires. Null defaults to 2am.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  scheduleHour?: number;

  // --- Shared ---

  @ApiPropertyOptional({ type: [ConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @ApiProperty({ type: [ActionConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionConfigDto)
  actions!: ActionConfigDto[];

  // --- Lifecycle ---

  @ApiPropertyOptional({ type: [LifecycleUpdateBindingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifecycleUpdateBindingDto)
  onSourceUpdated?: LifecycleUpdateBindingDto[];

  @ApiPropertyOptional({ type: [LifecycleDeleteBindingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifecycleDeleteBindingDto)
  onSourceDeleted?: LifecycleDeleteBindingDto[];
}
