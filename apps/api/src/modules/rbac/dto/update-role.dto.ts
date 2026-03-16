import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ example: 'senior-manager' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
