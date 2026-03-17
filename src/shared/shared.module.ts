import { Global, Module } from '@nestjs/common'

import { TokenService } from './services/token.service'
import { HashingService } from './services/hashing.service'
import { PrismaService } from './services/prisma.service'
import { RedisService } from './services/redis.service'
import { FirebaseService } from './services/firebase.service'
import { CloudinaryService } from './services/cloudinary.service'
import { AccessAuthGuard } from './guards/access-auth.guard'
import { JwtModule } from '@nestjs/jwt'
import { RefreshAuthGuard } from './guards/refresh-auth.guard'
import { MailService } from './services/mail.service'
import { BullModule } from '@nestjs/bullmq'
import { MAIL_QUEUE } from './queues/mail.queue'
import { MailProcessor } from './processors/mail.processor'

@Global()
@Module({
  providers: [
    PrismaService,
    TokenService,
    HashingService,
    RedisService,
    FirebaseService,
    CloudinaryService,
    MailService,
    MailProcessor,
    AccessAuthGuard,
    RefreshAuthGuard,
  ],
  exports: [
    PrismaService,
    TokenService,
    HashingService,
    RedisService,
    FirebaseService,
    CloudinaryService,
    MailService,
    AccessAuthGuard,
    RefreshAuthGuard,
  ],
  imports: [
    JwtModule.register({}),
    BullModule.registerQueue({
      name: MAIL_QUEUE,
    }),
  ],
})
export class SharedModule {}
