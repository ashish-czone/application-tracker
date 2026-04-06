import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  databaseUrl?: string;

  @IsOptional()
  @IsIn(['active', 'suspended', 'provisioning'])
  status?: string;

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

  @IsOptional()
  @IsString()
  clientId?: string;
}
