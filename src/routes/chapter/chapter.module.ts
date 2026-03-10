import { Module } from '@nestjs/common'
import { ChapterController } from './chapter.controller'
import { ChapterService } from './chapter.service'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [NotificationModule],
  controllers: [ChapterController],
  providers: [ChapterService],
  exports: [ChapterService],
})
export class ChapterModule {}
