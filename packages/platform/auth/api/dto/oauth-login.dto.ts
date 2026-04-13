import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthLoginDto {
  @ApiProperty({ example: '4/0AY0e-g...' , description: 'Authorization code from the OAuth provider' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  code!: string;

  @ApiProperty({ example: 'http://localhost:5173/oauth/callback', description: 'Redirect URI used in the authorization request' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  redirectUri!: string;
}
