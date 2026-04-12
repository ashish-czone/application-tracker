import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListPreferencesQueryDto {
  @ApiPropertyOptional({ description: 'Filter to a single namespace' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  namespace?: string;
}
