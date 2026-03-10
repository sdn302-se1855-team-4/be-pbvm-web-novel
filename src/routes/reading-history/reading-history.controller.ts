import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common'
import { ReadingHistoryService } from './reading-history.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'

@Controller('reading-history')
@UseGuards(AccessAuthGuard)
export class ReadingHistoryController {
  constructor(private readonly readingHistoryService: ReadingHistoryService) {}

  @Get('me')
  async getMyHistory(@ActiveUser('sub') userId: string, @Query('limit') limit?: string) {
    return this.readingHistoryService.getMyHistory(userId, limit ? parseInt(limit, 10) : 20)
  }

  @Post()
  async saveProgress(
    @ActiveUser('sub') userId: string,
    @Body() body: { storyId: string; chapterId: string; progress?: number; lastPosition?: number },
  ) {
    return this.readingHistoryService.saveProgress(userId, body)
  }
}
