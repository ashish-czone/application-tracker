import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class CleanJobsDto {
  @IsString()
  status!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  grace?: number = 0;
}
