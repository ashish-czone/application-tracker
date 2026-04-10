import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, MinLength, MaxLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CriteriaItemDto } from './criteria-item.dto';

export class CreateEvaluationTemplateDto {
  @ApiProperty({ example: 'Technical Interview Scorecard' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'technical-interview' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty({ example: 'interviews' })
  @IsString()
  @MaxLength(100)
  entityType!: string;

  @ApiProperty({ type: [CriteriaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaItemDto)
  criteria!: CriteriaItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
