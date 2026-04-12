import { IsDefined } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPreferenceDto {
  @ApiProperty({ description: 'Arbitrary JSON value for the preference' })
  @IsDefined()
  value!: unknown;
}
