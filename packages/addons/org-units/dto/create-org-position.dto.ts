import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateOrgPositionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
