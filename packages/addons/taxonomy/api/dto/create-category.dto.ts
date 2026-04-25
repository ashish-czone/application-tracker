import { IsString, IsOptional, IsUUID, IsInt, Min, MinLength, MaxLength, Matches, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'engineering' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase kebab-case' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Parent category ID (null for root)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Free-form key/value metadata. Keys are normalized to trimmed lowercase on write.', example: { iso3: 'USA', phone: '+1' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
