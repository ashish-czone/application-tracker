import { IsString, MinLength, MaxLength, IsOptional, IsUUID, IsArray, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransitionDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  @IsUUID()
  fromStateId!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000002' })
  @IsUUID()
  toStateId!: string;

  @ApiProperty({ example: 'Approve' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: ['orders.approve'], description: 'Permission strings required to execute this transition' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredPermissions?: string[];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: ['Not qualified', 'Salary mismatch', 'No show'], description: 'Picklist options shown when this transition is triggered' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reasonOptions?: string[];

  @ApiPropertyOptional({ example: false, description: 'Whether selecting a reason is required' })
  @IsOptional()
  @IsBoolean()
  reasonRequired?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Whether entering a comment is required' })
  @IsOptional()
  @IsBoolean()
  commentRequired?: boolean;
}
