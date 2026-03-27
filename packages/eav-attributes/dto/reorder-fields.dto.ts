import { IsArray, IsOptional, IsString, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class OrderedFieldItem {
  @IsString()
  fieldId!: string;

  @IsInt()
  columnIndex!: number;
}

export class ReorderFieldsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderedFieldIds?: string[];

  @ApiPropertyOptional({ type: [OrderedFieldItem] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedFieldItem)
  orderedFields?: OrderedFieldItem[];
}
