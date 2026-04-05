import { plainToInstance } from 'class-transformer';
import { IsIn, IsString, validateSync } from 'class-validator';

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

  @IsString()
  SERVICE_PRIVATE_KEY!: string;

  @IsString()
  TRUSTED_SERVICE_KEYS!: string;
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
