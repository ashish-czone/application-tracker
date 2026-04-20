import { IsArray, IsInt, IsUUID, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class SectionOrderDto {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderSectionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SectionOrderDto)
  orders!: SectionOrderDto[];
}
