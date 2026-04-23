import { IsArray, ValidateNested, IsString, MinLength, MaxLength, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ScopeSpecDto {
  @ApiProperty({ example: 'own' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  type!: string;

  @ApiPropertyOptional({ description: 'Optional parameters for parameterised scope types' })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

class PermissionEntryDto {
  @ApiProperty({ example: 'users.read' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ type: [ScopeSpecDto], description: 'Row-level scopes applied to this grant. Defaults to [{type:"any"}] if omitted.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScopeSpecDto)
  scopes?: ScopeSpecDto[];
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [PermissionEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}
