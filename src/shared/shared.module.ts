import { Module } from '@nestjs/common'

import { TokenService } from './services/token.service'
import { HashingService } from './services/hashing.service'
// import { Prisma } from '@prisma/client/extension'
// import { PrismaService } from './services/prisma.service'
import { AccessAuthGuard } from './guards/access-auth.guard'
import { JwtModule } from '@nestjs/jwt'
import { RefreshAuthGuard } from './guards/refresh-auth.guard'

@Module({
  providers: [TokenService, HashingService, AccessAuthGuard, RefreshAuthGuard],
  exports: [TokenService, HashingService, AccessAuthGuard, RefreshAuthGuard],
  imports: [JwtModule.register({})],
})
export class SharedModule {}
