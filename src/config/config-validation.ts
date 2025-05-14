import { plainToClass } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUrl, Min, validateSync } from 'class-validator';
import { Environment } from './constants';

class EnvironmentVariables {
  /* APP CONFIG */
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1)
  PORT: number;

  @IsString()
  APP_NAME: string;

  /* DATABASE CONFIG (OPTIONAL) */
  @IsOptional()
  @IsString()
  DATABASE_HOST: string;

  @IsOptional()
  @IsNumber()
  DATABASE_PORT: number;

  @IsOptional()
  @IsString()
  DATABASE_USERNAME: string;

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD: string;

  @IsOptional()
  @IsString()
  DATABASE_NAME: string;

  /* REDIS CONFIG */
  @IsOptional()
  @IsString()
  REDIS_HOST: string;

  @IsOptional()
  @IsNumber()
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD: string;

  @IsOptional()
  @IsNumber()
  REDIS_DB: number;

  /* WEB3 CONFIG */
  @IsOptional()
  @IsUrl()
  RPC_URL: string;

  @IsOptional()
  @IsNumber()
  CHAIN_ID: number;

  @IsOptional()
  @IsString()
  API_KEY: string;

  /* NETWORK CONFIG */
  @IsNumber()
  NETWORK_TIMEOUT: number;

  @IsNumber()
  NETWORK_RETRIES: number;

  /* CACHE CONFIG */
  @IsOptional()
  @IsNumber()
  CACHE_TTL: number;
}

export function validateConfig(config: Record<string, unknown>) {
  // 如果在 CI 環境中或 SKIP_ENV_VALIDATION 設置為 true，則跳過驗證
  if (process.env.CI === 'true' || process.env.SKIP_ENV_VALIDATION === 'true') {
    console.log('CI 環境或 SKIP_ENV_VALIDATION 設置為 true，跳過環境變數驗證');
    return config;
  }

  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    console.error('環境變數驗證錯誤:', errors);
    throw new Error('環境變數驗證失敗，請檢查上面的錯誤');
  }

  return validatedConfig;
}
