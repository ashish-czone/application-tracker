import { IsOptional, IsUUID } from 'class-validator';

export class AssignTaskDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
