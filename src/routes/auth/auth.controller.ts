import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'

@Controller('auth')
export class AuthController {
  @UseGuards(AuthGuard('access-jwt'))
  @Get('/hello')
  getHello(@Req() req: Request): string {
    return 'Hello ' + req.user?.userid
  }
}
