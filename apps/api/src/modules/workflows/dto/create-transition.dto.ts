import { IsString, MinLength, MaxLength, IsOptional, IsUUID, IsArray, IsInt, Min } from 'class-validator';
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

  @ApiPropertyOptional({ example: ['not-same-actor'], description: 'Guard function names to check before transition' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardNames?: string[];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
