import { IsArray, ValidateNested, IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PermissionEntryDto {
  @ApiProperty({ example: 'users.read' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'all', enum: ['own', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['own', 'all'])
  scope?: 'own' | 'all';
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [PermissionEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}
