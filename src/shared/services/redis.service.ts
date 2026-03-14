import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis
  private readonly logger = new Logger(RedisService.name)
  private readonly DEFAULT_TTL = 300 // 5 minutes

  constructor() {
    this.redis = new Redis(process.env.UPTASH_REDIS_HOST!, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
    })

    this.redis.on('connect', () => this.logger.log('Redis connected'))
    this.redis.on('error', (err) => this.logger.error('Redis error', err))
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key)
      if (!data) return null
      return JSON.parse(data) as T
    } catch {
      this.logger.error(`Redis GET error for key: ${key}`)
      return null
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      await this.redis.set(key, serialized, 'EX', ttl ?? this.DEFAULT_TTL)
    } catch {
      this.logger.error(`Redis SET error for key: ${key}`)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch {
      this.logger.error(`Redis DEL error for key: ${key}`)
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch {
      this.logger.error(`Redis DEL pattern error: ${pattern}`)
    }
  }

  onModuleDestroy() {
    this.redis.disconnect()
  }
}
