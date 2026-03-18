import { Test } from '@nestjs/testing'
import { RedisService } from './src/shared/services/redis.service'
import { ConfigModule } from '@nestjs/config'
import authConfig from './src/shared/config/auth.config'
import redisConfig from './src/shared/config/redis.config'

async function test() {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [authConfig, redisConfig],
      }),
    ],
    providers: [RedisService],
  }).compile()

  const redisService = module.get<RedisService>(RedisService)
  const userId = 'migration-test-user'
  const sessionsKey = `refresh_token:user:${userId}:sessions`

  console.log('--- Cleaning up ---')
  await redisService.del(sessionsKey)

  console.log('--- Case 1: Migration from SET to ZSET ---')
  // Manually create a SET using the internal redis instance (private, so use casting)
  const redisInstance = (redisService as any).redis
  await redisInstance.sadd(sessionsKey, 'legacy-jti-1', 'legacy-jti-2')
  console.log('Created legacy SET')

  const jti1 = 'jti-migration-1'
  const jtiKey1 = `refresh_token:jti:${jti1}`
  await redisService.addRefreshTokenSession(sessionsKey, jtiKey1, jti1, userId, 3, 3600, Date.now())
  console.log('Added new session via ZSET logic')

  // Verify type is now zset
  const type = await redisInstance.type(sessionsKey)
  console.log(`Key type: ${type} (Expected: zset)`)

  console.log('--- Case 2: FIFO Session Rotation (Limit 3) ---')
  for (let i = 2; i <= 4; i++) {
    const jti = `jti-rotation-${i}`
    const jtiKey = `refresh_token:jti:${jti}`
    // Use increasing scores to simulate passage of time
    await redisService.addRefreshTokenSession(sessionsKey, jtiKey, jti, userId, 3, 3600, Date.now() + i * 1000)
    console.log(`Added session rotation-${i}`)
  }

  // The very first one added (jti-migration-1) should be gone now because limit is 3
  const exists1 = await redisService.exists(`refresh_token:jti:${jti1}`)
  console.log(`Session ${jti1} exists: ${exists1} (Expected: false)`)

  const exists4 = await redisService.exists('refresh_token:jti:jti-rotation-4')
  console.log(`Session rotation-4 exists: ${exists4} (Expected: true)`)

  console.log('--- Case 3: Proper deletion during logout/rotation ---')
  await redisService.removeRefreshTokenSession(sessionsKey, 'refresh_token:jti:jti-rotation-4', 'jti-rotation-4')
  const exists4AfterDel = await redisService.exists('refresh_token:jti:jti-rotation-4')
  console.log(`Session rotation-4 exists after removal: ${exists4AfterDel} (Expected: false)`)

  await module.close()
}

test().catch(console.error)
