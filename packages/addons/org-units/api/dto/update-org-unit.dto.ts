import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateOrgUnitDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
