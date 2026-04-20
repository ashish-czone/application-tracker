import {
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateComplianceTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string;

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

  // Mirrors the workflow states declared in TASKS_FIELDS.status.workflow.
  // The generic /tasks path runs these through the full workflow engine
  // (permission guards on each transition); this endpoint doesn't yet —
  // class-validator gates the *values* and applyCompletedAt handles the
  // completedAt stamping. Per-transition permission guards are a follow-up.
  @IsOptional()
  @IsIn(['pending', 'in_progress', 'review', 'completed', 'cancelled'])
  status?: string;
}
