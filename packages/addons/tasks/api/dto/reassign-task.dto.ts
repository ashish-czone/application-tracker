import { IsOptional, IsUUID } from 'class-validator';

export class ReassignTaskDto {
  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsUUID()
  userId?: string | null;
}
