import { registerAs } from '@nestjs/config'
export interface RedisConfig {
  host: string
  port: number
  username: string
  password: string
  tls: boolean
}

export default registerAs(
  'redis',
  (): RedisConfig => ({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USER || 'default',
    password: process.env.REDIS_PASSWORD!,
    tls: process.env.REDIS_TLS === 'true',
  }),
)
