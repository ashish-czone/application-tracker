import { IsArray, ValidateNested, IsString, MinLength, IsDefined, Allow } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class SettingEntryDto {
  @ApiProperty({ example: 'accessTokenExpiresIn' })
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ example: '30m' })
  @IsDefined()
  @Allow()
  value: unknown;
}

export class UpdateModuleSettingsDto {
  @ApiProperty({ type: [SettingEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingEntryDto)
  settings!: SettingEntryDto[];
}
