import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateOrgUnitLevelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
