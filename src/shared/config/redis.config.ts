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
    host: process.env.UPTASH_REDIS_HOST!,
    port: parseInt(process.env.UPTASH_REDIS_PORT || '6379', 10),
    username: process.env.UPTASH_REDIS_USER || 'default',
    password: process.env.UPTASH_REDIS_PASSWORD!,
    tls: process.env.UPTASH_REDIS_TLS === 'true',
  }),
)
