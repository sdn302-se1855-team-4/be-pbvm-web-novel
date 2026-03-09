import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ReviewService } from './review.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(AccessAuthGuard)
  async create(@ActiveUser('sub') userId: string, @Body() body: { storyId: string; rating: number; content?: string }) {
    return this.reviewService.createReview(userId, body)
  }

  @Get('story/:storyId')
  async getByStory(@Param('storyId') storyId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.reviewService.getReviews(storyId, page ? +page : 1, limit ? +limit : 10)
  }

  @Delete(':id')
  @UseGuards(AccessAuthGuard)
  async delete(@ActiveUser('sub') userId: string, @Param('id') id: string) {
    return this.reviewService.deleteReview(userId, id)
  }
}
