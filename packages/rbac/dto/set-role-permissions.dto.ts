import { IsArray, ValidateNested, IsString, IsOptional, Matches, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PermissionEntryDto {
  @ApiProperty({ example: 'users.read' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'all', description: 'all | team | own | scope:<custom-key>' })
  @IsOptional()
  @IsString()
  @Matches(/^(all|team|own|scope:[a-z0-9-]+)$/, { message: 'scope must be all, team, own, or scope:<key>' })
  scope?: string;
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [PermissionEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}
