import { IsString, IsOptional, IsInt, Min, MinLength, MaxLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryGroupDto {
  @ApiProperty({ example: 'Departments' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'departments' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase kebab-case' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Company departments' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
