import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CriteriaItemDto {
  @ApiProperty({ example: 'Problem Solving' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Ability to break down complex problems' })
  @IsString()
  @MaxLength(500)
  description!: string;
}
