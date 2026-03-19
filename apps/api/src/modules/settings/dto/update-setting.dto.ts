import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({ description: 'The new value for the setting', example: '30m' })
  @IsDefined({ message: 'Value is required' })
  value!: unknown;
}
