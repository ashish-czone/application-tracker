import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveCategoryDto {
  @ApiPropertyOptional({ description: 'New parent category ID (null to make root)' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
