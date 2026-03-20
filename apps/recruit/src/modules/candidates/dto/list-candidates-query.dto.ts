import { IsOptional, IsString, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class ListCandidatesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['referral', 'job-board', 'website', 'direct', 'linkedin'] })
  @IsOptional()
  @IsIn(['referral', 'job-board', 'website', 'direct', 'linkedin'])
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ enum: ['high-school', 'bachelors', 'masters', 'phd', 'other'] })
  @IsOptional()
  @IsIn(['high-school', 'bachelors', 'masters', 'phd', 'other'])
  qualification?: string;

  @ApiPropertyOptional({ enum: ['firstName', 'email', 'createdAt', 'country'] })
  @IsOptional()
  @IsIn(['firstName', 'email', 'createdAt', 'country'])
  sort?: 'firstName' | 'email' | 'createdAt' | 'country' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;
}
