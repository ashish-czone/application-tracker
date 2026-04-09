import { IsString, IsOptional, IsInt, IsArray, IsUUID, IsIn, ValidateNested, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScoreItemDto } from './score-item.dto';
import { RECOMMENDATION_VALUES } from '../types';

export class CreateEvaluationDto {
  @ApiProperty({ example: 'tmpl-uuid' })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ example: 'interviews' })
  @IsString()
  @MaxLength(100)
  entityType!: string;

  @ApiProperty({ example: 'entity-uuid' })
  @IsUUID()
  entityId!: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @ApiProperty({ example: 'strong_yes', enum: RECOMMENDATION_VALUES })
  @IsString()
  @IsIn(RECOMMENDATION_VALUES)
  recommendation!: string;

  @ApiPropertyOptional({ example: 'Strong candidate overall' })
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  comment?: string;

  @ApiProperty({ type: [ScoreItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores!: ScoreItemDto[];
}
