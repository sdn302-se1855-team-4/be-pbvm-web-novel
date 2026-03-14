import { plainToInstance } from 'class-transformer'
import { IsNotEmpty, IsString, validateSync } from 'class-validator'
import * as fs from 'fs'
import path from 'path'
import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env' })

//kiểm tra .env tồn tại hay chưa
if (!fs.existsSync(path.resolve('.env'))) {
  console.log('không tìm thấy file .env')
  process.exit(1)
}

class ConfigSchema {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string

  @IsString()
  ACCESS_TOKEN_SECRET: string

  @IsString()
  ACCESS_TOKEN_EXPIRES_IN: string

  @IsString()
  REFRESH_TOKEN_SECRET: string

  @IsString()
  REFRESH_TOKEN_EXPIRES_IN: string

  @IsString()
  SECRET_API_KEY: string

  @IsString()
  PAYOS_CLIENT_ID: string

  @IsString()
  PAYOS_API_KEY: string

  @IsString()
  PAYOS_CHECKSUM_KEY: string

  @IsString()
  UPTASH_REDIS_HOST: string

  @IsString()
  UPTASH_REDIS_PASSWORD: string

  @IsString()
  UPTASH_REDIS_PORT: string

  @IsString()
  UPTASH_REDIS_USER: string

  @IsString()
  UPTASH_REDIS_TLS: string

  @IsString()
  FIREBASE_PROJECT_ID: string

  @IsString()
  FIREBASE_CLIENT_EMAIL: string

  @IsString()
  FIREBASE_PRIVATE_KEY: string
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(ConfigSchema, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validatedConfig, { skipMissingProperties: false })

  if (errors.length > 0) {
    const errorMessages = errors.map((e) => {
      return {
        property: e.property,
        constraints: e.constraints,
        value: e.value,
      }
    })
    console.error('Environment variables validation failed:', JSON.stringify(errorMessages, null, 2))
    throw new Error('Environment variables validation failed')
  }
  return validatedConfig
}
