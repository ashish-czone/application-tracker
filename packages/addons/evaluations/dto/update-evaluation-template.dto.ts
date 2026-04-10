import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CriteriaItemDto } from './criteria-item.dto';

export class UpdateEvaluationTemplateDto {
  @ApiPropertyOptional({ example: 'Updated Scorecard Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ type: [CriteriaItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriteriaItemDto)
  criteria?: CriteriaItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
