import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  LoginBodyDTO,
  RegisterBodyDTO,
  GoogleLoginBodyDTO,
  ForgotPasswordBodyDTO,
  ResetPasswordBodyDTO,
  ChangePasswordBodyDTO,
} from './auth.dto/auth.dto'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { RefreshAuthGuard } from 'src/shared/guards/refresh-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'

@ApiTags('auth')
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

  @Post('google')
  @ResponseMessage('Đăng nhập Google thành công')
  googleLogin(@Body() body: GoogleLoginBodyDTO) {
    return this.authService.googleLogin(body.idToken)
  }

  @Post('refresh')
  @ApiBearerAuth()
  @UseGuards(RefreshAuthGuard)
  @ResponseMessage('Refresh token thành công')
  refreshToken(@ActiveUser() user: Express.User & { jti?: string }) {
    return this.authService.refreshToken(user.userId, user.jti)
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(RefreshAuthGuard)
  @ResponseMessage('Đăng xuất thành công')
  logout(@ActiveUser() user: Express.User & { jti?: string }) {
    return this.authService.logout(user.userId, user.jti)
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Lấy thông tin profile thành công')
  getProfile(@ActiveUser() user: Express.User) {
    return this.authService.getProfile(user.userId)
  }

  @Post('forgot-password')
  @ResponseMessage('Yêu cầu đặt lại mật khẩu đã được gửi')
  async forgotPassword(@Body() body: ForgotPasswordBodyDTO) {
    return await this.authService.forgotPassword(body.email)
  }

  @Post('reset-password')
  @ResponseMessage('Đặt lại mật khẩu thành công')
  async resetPassword(@Body() body: ResetPasswordBodyDTO) {
    return await this.authService.resetPassword(body)
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Đổi mật khẩu thành công')
  async changePassword(@ActiveUser() user: Express.User, @Body() body: ChangePasswordBodyDTO) {
    return await this.authService.changePassword(user.userId, body)
  }
}
