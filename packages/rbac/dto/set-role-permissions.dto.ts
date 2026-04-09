import { IsArray, ValidateNested, IsString, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PermissionEntryDto {
  @ApiProperty({ example: 'users.read' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [PermissionEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}
