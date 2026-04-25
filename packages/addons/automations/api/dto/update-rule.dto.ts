import { IsString, MinLength, MaxLength, IsOptional, IsArray, ValidateNested, IsObject, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateRuleDto } from './create-rule.dto';

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: 'Updated rule name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  conditions?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  actions?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  onSourceUpdated?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  onSourceDeleted?: any[];
}
