import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateOrgUnitLevelDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
