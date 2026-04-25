import { IsString, MinLength, MaxLength, IsOptional, IsArray, IsInt, IsBoolean, Min, IsObject } from 'class-validator';
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

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: ['Not qualified', 'Salary mismatch'], description: 'Picklist options shown when this transition is triggered' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reasonOptions?: string[] | null;

  @ApiPropertyOptional({ example: false, description: 'Whether selecting a reason is required' })
  @IsOptional()
  @IsBoolean()
  reasonRequired?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Whether entering a comment is required' })
  @IsOptional()
  @IsBoolean()
  commentRequired?: boolean;

  @ApiPropertyOptional({ description: 'Arbitrary metadata (e.g., conditions)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
