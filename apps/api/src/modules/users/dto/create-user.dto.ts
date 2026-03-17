import { IsEmail, IsString, MinLength, MaxLength, IsIn, IsUUID, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

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

  @ApiProperty({ example: ['00000000-0000-0000-0000-000000000000'], description: 'Roles to assign to the user' })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role is required' })
  @IsUUID('4', { each: true })
  roleIds!: string[];
}
