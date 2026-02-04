import { plainToInstance, Transform } from 'class-transformer'
import { IsNotEmpty, IsString, validateSync } from 'class-validator'
import * as fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
config({
  path: '.env',
})
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
  @Transform(({ value }) => Number(value))
  ACCESS_TOKEN_EXPIRES_IN: number

  @IsString()
  REFRESH_TOKEN_SECRET: string
  @Transform(({ value }) => Number(value))
  REFRESH_TOKEN_EXPIRES_IN: number

  @IsString()
  SECRET_API_KEY: string
}

const configServer = plainToInstance(ConfigSchema, process.env, {
  enableImplicitConversion: true,
})
const e = validateSync(configServer)
if (e.length > 0) {
  console.log('các giá trị trong .env ko hợp lệ')
  const errors = e.map((eItem) => {
    return {
      poperty: eItem.property,
      constraints: eItem.constraints,
      value: eItem.value as unknown,
    }
  })
  throw errors as unknown
}
const envConfig = configServer
// console.log(process.env)
export default envConfig
