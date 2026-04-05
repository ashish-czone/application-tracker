import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  databaseUrl!: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsString()
  planExpiry?: string;
}
