import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'

import { SharedModule } from 'src/shared/shared.module'
import { AuthService } from './auth.service'
import { RefreshStrategy } from './strategy/refresh.strategy'
import { AccessStrategy } from './strategy/access.strategy'

@Module({
  controllers: [AuthController],
  providers: [AccessStrategy, RefreshStrategy, AuthService],
  imports: [SharedModule],
})
export class AuthModule {}
