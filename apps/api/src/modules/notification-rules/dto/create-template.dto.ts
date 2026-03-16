import { IsString, MinLength, MaxLength, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Welcome Email' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'email', enum: ['email', 'in_app', 'whatsapp'] })
  @IsString()
  @IsIn(['email', 'in_app', 'whatsapp'])
  channel!: string;

  @ApiPropertyOptional({ example: 'Welcome {{payload.firstName}}!' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @ApiProperty({ example: 'Hello {{payload.firstName}}, your account is ready.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;
}
