import { IsEmail, IsString, MinLength, MaxLength, IsArray, IsIn, ArrayMinSize } from 'class-validator';
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

  @ApiProperty({ example: ['admin'], enum: ['admin', 'client'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(['admin', 'client'], { each: true })
  userTypes!: string[];
}
