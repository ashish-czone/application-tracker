import { Transform } from 'class-transformer';
import { IsISO8601, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListComplianceTasksDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  ruleId?: string;

  @IsOptional()
  @IsUUID()
  lawId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  assigneeTeamId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  periodFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  periodTo?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueTo?: string;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value as string, 10))
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['dueDate', 'periodStart', 'createdAt'])
  orderBy?: 'dueDate' | 'periodStart' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';
}
