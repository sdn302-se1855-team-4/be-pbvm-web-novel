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

@Module({
  imports: [SharedModule, AuthModule, StoryModule, FollowModule, CommentModule, ChapterModule, BookmarkModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_PIPE, useClass: CustomZodValidationPipe }],
})
export class AppModule {}
