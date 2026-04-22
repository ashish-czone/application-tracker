import { IsOptional, IsUUID } from 'class-validator';

export class ReassignTaskDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
