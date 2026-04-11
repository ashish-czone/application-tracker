import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateOrgUnitDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  levelId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
