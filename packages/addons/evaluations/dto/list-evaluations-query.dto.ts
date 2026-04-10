import { IsString, IsOptional, IsInt, IsUUID, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEvaluationsQueryDto {
  @IsString()
  @MaxLength(100)
  entityType!: string;

  @IsUUID()
  entityId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
