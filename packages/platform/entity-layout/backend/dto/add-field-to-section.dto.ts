import { IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddFieldToSectionDto {
  @ApiProperty()
  @IsString()
  fieldId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  columnIndex?: number;
}
