import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagGroupDto {
  @ApiProperty({ example: 'Priority' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'priority' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug must be lowercase kebab-case' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Priority levels for items' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: false, default: true })
  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean;
}
