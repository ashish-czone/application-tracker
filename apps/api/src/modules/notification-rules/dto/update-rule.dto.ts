import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: 'Updated rule name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'actor', enum: ['actor', 'entity_owner', 'role'] })
  @IsOptional()
  @IsString()
  @IsIn(['actor', 'entity_owner', 'role'])
  recipientStrategy?: string;

  @ApiPropertyOptional({ example: { roleId: '...' } })
  @IsOptional()
  @IsObject()
  recipientConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
