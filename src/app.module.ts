import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SharedModule } from './shared/shared.module'

import { AuthModule } from './routes/auth/auth.module'
import { StoryModule } from './routes/story/story.module'
import { FollowModule } from './routes/follow/follow.module'
import { CommentModule } from './routes/comment/comment.module'
import { ChapterModule } from './routes/chapter/chapter.module'
import { BookmarkModule } from './routes/bookmark/bookmark.module'

import { APP_PIPE } from '@nestjs/core'
import { CustomZodValidationPipe } from './shared/pipes/custom-zod-Validation.pipe'
import { AdminModule } from './routes/admin/admin.module'
import { ReadingHistoryModule } from './routes/reading-history/reading-history.module'
import { WalletModule } from './routes/wallet/wallet.module'
import { ReviewModule } from './routes/review/review.module'
import { NotificationModule } from './routes/notification/notification.module'
import { ProfileModule } from './routes/profile/profile.module'

@Module({
  imports: [
    SharedModule,
    AuthModule,
    StoryModule,
    FollowModule,
    CommentModule,
    ChapterModule,
    BookmarkModule,
    AdminModule,
    ReadingHistoryModule,
    WalletModule,
    ReviewModule,
    NotificationModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_PIPE, useClass: CustomZodValidationPipe }],
})
export class AppModule {}
