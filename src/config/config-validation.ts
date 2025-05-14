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
}

export function validateConfig(config: Record<string, unknown>) {
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
