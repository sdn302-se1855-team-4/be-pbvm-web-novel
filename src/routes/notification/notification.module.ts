import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'
import { NotificationConsumer } from './notification.consumer'

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationConsumer],
  exports: [NotificationService],
})
export class NotificationModule {}
