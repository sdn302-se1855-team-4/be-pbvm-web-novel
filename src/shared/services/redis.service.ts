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
   *   1. Add the new jti to the user's session ZSET with timestamp as score
   *   2. Set the jti key with userId as value (JSON stringified)
   *   3. If sessions exceed maxSessions, remove the oldest jti(s)
   *   4. Set TTL on all keys
   *
   * @param sessionsKey ZSET key for user sessions
   * @param jtiKey STRING key for jti mapping
   * @param jti JWT identifier
   * @param userId The User ID
   * @param maxSessions Max sessions allowed
   * @param ttl TTL in seconds
   * @param score Timestamp (score) for the ZSET
   */
  async addRefreshTokenSession(
    sessionsKey: string,
    jtiKey: string,
    jti: string,
    userId: string,
    maxSessions: number,
    ttl: number,
    score: number,
  ): Promise<void> {
    const luaScript = `
      -- Check if the key exists and if it's a ZSET. If not (e.g., it's the old SET), delete it.
      local currentType = redis.call('TYPE', KEYS[1])['ok']
      if currentType ~= 'zset' and currentType ~= 'none' then
        redis.call('DEL', KEYS[1])
      end

      -- Add the new jti to sessions ZSET
      redis.call('ZADD', KEYS[1], ARGV[5], ARGV[1])

      -- Store jti -> userId mapping (JSON stringified for service compatibility)
      redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[4]))

      -- Get number of sessions
      local count = redis.call('ZCARD', KEYS[1])
      local maxSessions = tonumber(ARGV[3])

      -- If over max, remove oldest sessions (lowest scores)
      if count > maxSessions then
        local toRemove = count - maxSessions
        -- Get the JTIs that are about to be removed
        local oldJtis = redis.call('ZRANGE', KEYS[1], 0, toRemove - 1)
        for i = 1, #oldJtis do
          redis.call('DEL', 'refresh_token:jti:' .. oldJtis[i])
        end
        -- Remove from ZSET
        redis.call('ZREMRANGEBYRANK', KEYS[1], 0, toRemove - 1)
      end

      -- Set TTL on sessions ZSET
      redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))

      return 1
    `

    try {
      // Stringify userId to match RedisService.get expectations
      const serializedUserId = JSON.stringify(userId)
      await this.redis.eval(
        luaScript,
        2,
        sessionsKey,
        jtiKey,
        jti,
        serializedUserId,
        maxSessions.toString(),
        ttl.toString(),
        score.toString(),
      )
    } catch (err) {
      this.logger.error('Redis Lua script error (addRefreshTokenSession)', err)
      throw err
    }
  }

  /**
   * Atomically remove a refresh token session (on logout or token rotation).
   *
   * KEYS[1] = sessions ZSET key
   * KEYS[2] = jti key
   * ARGV[1] = jti
   */
  async removeRefreshTokenSession(sessionsKey: string, jtiKey: string, jti: string): Promise<void> {
    const luaScript = `
      -- Check if the key exists and if it's a ZSET.
      local currentType = redis.call('TYPE', KEYS[1])['ok']
      if currentType == 'zset' then
        redis.call('ZREM', KEYS[1], ARGV[1])
      elseif currentType ~= 'none' then
        -- If it's the old SET, we can just delete the whole sessions key to migrate
        redis.call('DEL', KEYS[1])
      end
      
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
