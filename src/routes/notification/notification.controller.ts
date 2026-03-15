import { Controller, Get, Put, Param, Query, UseGuards, Sse, MessageEvent, Post, Body, Delete } from '@nestjs/common'
import { NotificationService } from './notification.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'
import { Observable } from 'rxjs'
import { filter, map } from 'rxjs/operators'

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

  @Sse('stream')
  sse(@ActiveUser('sub') userId: string): Observable<MessageEvent> {
    return this.notificationService.notification$.pipe(
      filter((event) => event.userId === userId),
      map((event) => ({
        data: event.notification,
      })),
    )
  }

  @Post('fcm-token')
  @ResponseMessage('Đăng ký nhận thông báo thành công')
  async registerFcmToken(
    @ActiveUser('sub') userId: string,
    @Body('token') token: string,
    @Body('device') device?: string,
  ) {
    return this.notificationService.registerFcmToken(userId, token, device)
  }

  @Delete('fcm-token/:token')
  @ResponseMessage('Hủy đăng ký nhận thông báo thành công')
  async unregisterFcmToken(@Param('token') token: string) {
    return this.notificationService.unregisterFcmToken(token)
  }
}
