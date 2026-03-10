import { Module } from '@nestjs/common'
import { FollowController } from './follow.controller'
import { FollowService } from './follow.service'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [NotificationModule],
  controllers: [FollowController],
  providers: [FollowService],
})
export class FollowModule {}
