import { Global, Module } from '@nestjs/common'

import { TokenService } from './services/token.service'
import { HashingService } from './services/hashing.service'
import { PrismaService } from './services/prisma.service'
import { AccessAuthGuard } from './guards/access-auth.guard'
import { JwtModule } from '@nestjs/jwt'
import { RefreshAuthGuard } from './guards/refresh-auth.guard'

@Global()
@Module({
  providers: [PrismaService, TokenService, HashingService, AccessAuthGuard, RefreshAuthGuard],
  exports: [PrismaService, TokenService, HashingService, AccessAuthGuard, RefreshAuthGuard],
  imports: [JwtModule.register({})],
})
export class SharedModule {}
