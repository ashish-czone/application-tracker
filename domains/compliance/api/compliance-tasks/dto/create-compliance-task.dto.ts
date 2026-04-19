import {
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateComplianceTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsISO8601({ strict: true })
  dueDate!: string;

  @IsUUID()
  ruleId!: string;

  @IsUUID()
  clientId!: string;

  @IsUUID()
  lawId!: string;

  @IsISO8601({ strict: true })
  periodStart!: string;

  @IsISO8601({ strict: true })
  periodEnd!: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  assigneeTeamId?: string;
}
