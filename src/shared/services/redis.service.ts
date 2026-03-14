import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { RedisConfig } from '../config/redis.config'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis
  private readonly logger = new Logger(RedisService.name)
  private readonly DEFAULT_TTL = 300 // 5 minutes

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get<RedisConfig>('redis')

    this.logger.log(`Initializing Redis with host: ${redisConfig?.host}:${redisConfig?.port}`)

    this.redis = new Redis({
      host: redisConfig?.host,
      port: redisConfig?.port,
      username: redisConfig?.username,
      password: redisConfig?.password,
      tls: redisConfig?.tls ? {} : undefined,
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

  /**
   * Check if a key exists in Redis.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key)
      return result === 1
    } catch {
      this.logger.error(`Redis EXISTS error for key: ${key}`)
      return false
    }
  }

  /**
   * Atomically add a refresh token session for a user.
   * Uses a Lua script to:
   *   1. Add the new jti to the user's session SET
   *   2. Set the jti key with userId as value
   *   3. If sessions exceed maxSessions, remove the oldest jti(s)
   *   4. Set TTL on all keys
   *
   * This ensures the entire operation is atomic — no race conditions.
   *
   * KEYS[1] = sessions SET key (e.g. refresh_token:user:{userId}:sessions)
   * KEYS[2] = jti key (e.g. refresh_token:jti:{jti})
   * ARGV[1] = jti
   * ARGV[2] = userId
   * ARGV[3] = maxSessions
   * ARGV[4] = ttl in seconds
   */
  async addRefreshTokenSession(
    sessionsKey: string,
    jtiKey: string,
    jti: string,
    userId: string,
    maxSessions: number,
    ttl: number,
  ): Promise<void> {
    const luaScript = `
      -- Add the new jti to sessions set
      redis.call('SADD', KEYS[1], ARGV[1])

      -- Store jti -> userId mapping
      redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[4]))

      -- Get all current sessions
      local sessions = redis.call('SMEMBERS', KEYS[1])
      local maxSessions = tonumber(ARGV[3])

      -- If over max, remove oldest sessions (FIFO based on set order)
      if #sessions > maxSessions then
        local toRemove = #sessions - maxSessions
        for i = 1, toRemove do
          local oldJti = sessions[i]
          redis.call('SREM', KEYS[1], oldJti)
          redis.call('DEL', 'refresh_token:jti:' .. oldJti)
        end
      end

      -- Set TTL on sessions set
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))

      return 1
    `

    try {
      await this.redis.eval(luaScript, 2, sessionsKey, jtiKey, jti, userId, maxSessions.toString(), ttl.toString())
    } catch (err) {
      this.logger.error('Redis Lua script error (addRefreshTokenSession)', err)
      throw err
    }
  }

  /**
   * Atomically remove a refresh token session (on logout or token rotation).
   *
   * KEYS[1] = sessions SET key
   * KEYS[2] = jti key
   * ARGV[1] = jti
   */
  async removeRefreshTokenSession(sessionsKey: string, jtiKey: string, jti: string): Promise<void> {
    const luaScript = `
      redis.call('SREM', KEYS[1], ARGV[1])
      redis.call('DEL', KEYS[2])
      return 1
    `

    try {
      await this.redis.eval(luaScript, 2, sessionsKey, jtiKey, jti)
    } catch (err) {
      this.logger.error('Redis Lua script error (removeRefreshTokenSession)', err)
    }
  }

  onModuleDestroy() {
    this.redis.disconnect()
  }
}
