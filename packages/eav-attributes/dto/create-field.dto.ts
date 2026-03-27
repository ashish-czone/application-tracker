import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsBoolean, IsInt, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FIELD_TYPES = [
  'text', 'email', 'phone', 'number', 'currency', 'decimal',
  'date', 'datetime', 'boolean', 'url', 'textarea',
  'picklist', 'multi_select', 'lookup', 'user',
] as const;

export class CreateFieldDto {
  @ApiProperty({ example: 'candidates' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType!: string;

  @ApiProperty({ example: 'shoe_size' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fieldKey!: string;

  @ApiProperty({ example: 'Shoe Size' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ example: 'number', enum: FIELD_TYPES })
  @IsString()
  @IsIn(FIELD_TYPES)
  fieldType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uiType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isQuickCreate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isReadonly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ description: 'Target entity for lookup fields' })
  @IsOptional()
  @IsString()
  lookupEntity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lookupLabelField?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lookupSearchFields?: string[];
}
