import { IsString, IsOptional, IsInt, IsArray, ValidateNested, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScoreItemDto } from './score-item.dto';

export class UpdateEvaluationDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

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
