import { Controller, Get, Param, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { RolesGuard } from 'src/shared/guards/roles.guard'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(AccessAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ResponseMessage('Lấy thống kê hệ thống thành công')
  getStats() {
    return this.adminService.getStats()
  }

  @Get('users')
  @ResponseMessage('Lấy danh sách người dùng thành công')
  getUsers() {
    return this.adminService.getUsers()
  }

  @Get('stories')
  @ResponseMessage('Lấy danh sách truyện thành công')
  getStories() {
    return this.adminService.getStories()
  }

  @Put('stories/:id/approve')
  @ResponseMessage('Duyệt truyện thành công')
  approveStory(@Param('id') id: string) {
    return this.adminService.approveStory(id)
  }

  @Put('stories/:id/reject')
  @ResponseMessage('Từ chối truyện thành công')
  rejectStory(@Param('id') id: string) {
    return this.adminService.rejectStory(id)
  }

  @Get('withdrawals')
  @ResponseMessage('Lấy danh sách yêu cầu rút tiền thành công')
  getWithdrawals() {
    return this.adminService.getWithdrawals()
  }

  @Put('withdrawals/:id/approve')
  @ResponseMessage('Duyệt yêu cầu rút tiền thành công')
  approveWithdrawal(@Param('id') id: string) {
    return this.adminService.approveWithdrawal(id)
  }

  @Put('withdrawals/:id/reject')
  @ResponseMessage('Từ chối yêu cầu rút tiền thành công')
  rejectWithdrawal(@Param('id') id: string) {
    return this.adminService.rejectWithdrawal(id)
  }
}
