import { IsString, MinLength, MaxLength, IsOptional, IsArray, IsInt, Min, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransitionDto {
  @ApiPropertyOptional({ example: 'Approve Order' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: ['orders.approve'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredPermissions?: string[] | null;

  @ApiPropertyOptional({ example: ['not-same-actor'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardNames?: string[] | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Arbitrary metadata (e.g., conditions)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
