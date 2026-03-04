import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { FollowService } from './follow.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'

@Controller('follow')
@UseGuards(AccessAuthGuard)
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':userId')
  @ResponseMessage('Follow thành công')
  follow(@ActiveUser() user: Express.User, @Param('userId') followingId: string) {
    return this.followService.follow(user.userId, followingId)
  }

  @Delete(':userId')
  @ResponseMessage('Unfollow thành công')
  unfollow(@ActiveUser() user: Express.User, @Param('userId') followingId: string) {
    return this.followService.unfollow(user.userId, followingId)
  }

  @Get('following')
  @ResponseMessage('Lấy danh sách following thành công')
  getFollowing(@ActiveUser() user: Express.User, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.followService.getFollowing(user.userId, page, limit)
  }

  @Get('followers')
  @ResponseMessage('Lấy danh sách followers thành công')
  getFollowers(@ActiveUser() user: Express.User, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.followService.getFollowers(user.userId, page, limit)
  }

  @Get('check/:userId')
  @ResponseMessage('Kiểm tra follow thành công')
  isFollowing(@ActiveUser() user: Express.User, @Param('userId') followingId: string) {
    return this.followService.isFollowing(user.userId, followingId)
  }
}
