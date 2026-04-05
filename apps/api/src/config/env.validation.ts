import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsIn(['development', 'staging', 'production', 'test'])
  NODE_ENV!: string;

  @IsString()
  ALLOWED_ORIGINS!: string;

  @IsOptional()
  @IsIn(['rls', 'database'])
  TENANCY_MODE?: string;

  @IsOptional()
  @IsIn(['subdomain', 'header', 'jwt'])
  TENANCY_RESOLVER?: string;

  @IsOptional()
  @IsString()
  TENANCY_HEADER?: string;

  @IsOptional()
  @IsString()
  TENANCY_JWT_CLAIM?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
