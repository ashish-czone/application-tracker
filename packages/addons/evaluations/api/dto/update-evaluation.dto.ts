import { IsString, IsOptional, IsInt, IsArray, IsIn, ValidateNested, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScoreItemDto } from './score-item.dto';
import { RECOMMENDATION_VALUES } from '../types';

export class UpdateEvaluationDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiPropertyOptional({ example: 'yes', enum: RECOMMENDATION_VALUES })
  @IsOptional()
  @IsString()
  @IsIn(RECOMMENDATION_VALUES)
  recommendation?: string;

  @ApiPropertyOptional({ example: 'Updated assessment' })
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  comment?: string;

  @ApiPropertyOptional({ type: [ScoreItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores?: ScoreItemDto[];
}
