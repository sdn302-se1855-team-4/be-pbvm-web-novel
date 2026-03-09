import { Controller, Get, Put, Param, Query, UseGuards } from '@nestjs/common'
import { NotificationService } from './notification.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'

@Controller('notifications')
@UseGuards(AccessAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @ActiveUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.getNotifications(userId, page ? +page : 1, limit ? +limit : 20)
  }

  @Put(':id/read')
  async markAsRead(@ActiveUser('sub') userId: string, @Param('id') id: string) {
    return this.notificationService.markAsRead(userId, id)
  }

  @Put('read-all')
  async markAllAsRead(@ActiveUser('sub') userId: string) {
    return this.notificationService.markAllAsRead(userId)
  }
}
