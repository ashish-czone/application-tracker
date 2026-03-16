import { IsEmail, IsString, MinLength, MaxLength, IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'StrongP@ss1' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'admin', enum: ['admin', 'client'] })
  @IsString()
  @IsIn(['admin', 'client'])
  userType!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000', description: 'Role to assign to the user' })
  @IsUUID()
  roleId!: string;
}
