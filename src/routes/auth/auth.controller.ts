import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginBodyDTO, RegisterBodyDTO } from './auth.dto/auth.dto'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { RefreshAuthGuard } from 'src/shared/guards/refresh-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ResponseMessage('Đăng ký thành công')
  register(@Body() body: RegisterBodyDTO) {
    return this.authService.register(body)
  }

  @Post('login')
  @ResponseMessage('Đăng nhập thành công')
  login(@Body() body: LoginBodyDTO) {
    return this.authService.login(body)
  }

  @Post('refresh')
  @UseGuards(RefreshAuthGuard)
  @ResponseMessage('Refresh token thành công')
  refreshToken(@ActiveUser() user: Express.User) {
    return this.authService.refreshToken(user.userId)
  }

  @Get('profile')
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Lấy thông tin profile thành công')
  getProfile(@ActiveUser() user: Express.User) {
    return this.authService.getProfile(user.userId)
  }
}
