import { IsString, IsOptional, IsInt, IsArray, IsUUID, ValidateNested, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScoreItemDto } from './score-item.dto';

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
