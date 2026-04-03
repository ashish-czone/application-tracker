import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({ example: 'StrongP@ss1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
