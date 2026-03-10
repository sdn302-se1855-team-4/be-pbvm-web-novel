import { Module } from '@nestjs/common'
import { StoryController } from './story.controller'
import { StoryService } from './story.service'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [NotificationModule],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
