import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEvaluationTemplatesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

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
