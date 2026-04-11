import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AssignTaskDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
