import { Controller, Get, /*Post, Body,*/ UseGuards, Query /*Res*/ } from '@nestjs/common'
import { WalletService } from './wallet.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
// import { DepositBodyDTO, PurchaseChapterBodyDTO, DonateBodyDTO, WithdrawBodyDTO } from './wallet.dto'
// import type { Response } from 'express'

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @UseGuards(AccessAuthGuard)
  async getWallet(@ActiveUser('sub') userId: string) {
    return this.walletService.getWallet(userId)
  }

  // @Post('deposit')
  // @UseGuards(AccessAuthGuard)
  // async deposit(@ActiveUser('sub') userId: string, @Body() body: DepositBodyDTO) {
  //   return this.walletService.createDepositLink(userId, body)
  // }

  // @Get('deposit/verify')
  // @UseGuards(AccessAuthGuard)
  // async verifyDeposit(@ActiveUser('sub') userId: string, @Query('orderCode') orderCode: string) {
  //   return this.walletService.verifyDeposit(userId, parseInt(orderCode, 10))
  // }

  // @Get('deposit/cancel')
  // @UseGuards(AccessAuthGuard)
  // async cancelDeposit(@ActiveUser('sub') userId: string, @Query('orderCode') orderCode: string) {
  //   return this.walletService.cancelDeposit(userId, parseInt(orderCode, 10))
  // }

  // PayOS Webhook — NO AUTH (PayOS calls this directly)
  // @Post('payos-webhook')
  // async payosWebhook(@Body() body: Record<string, unknown>, @Res() res: Response) {
  //   const result = await this.walletService.handlePayosWebhook(body)
  //   return res.status(200).json(result)
  // }

  // @Post('withdraw')
  // @UseGuards(AccessAuthGuard)
  // async withdraw(@ActiveUser('sub') userId: string, @Body() body: WithdrawBodyDTO) {
  //   return await this.walletService.withdraw(userId, body)
  // }

  // @Post('purchase-chapter')
  // @UseGuards(AccessAuthGuard)
  // async purchaseChapter(@ActiveUser('sub') userId: string, @Body() body: PurchaseChapterBodyDTO) {
  //   return this.walletService.purchaseChapter(userId, body)
  // }

  // @Post('donate')
  // @UseGuards(AccessAuthGuard)
  // async donate(@ActiveUser('sub') userId: string, @Body() body: DonateBodyDTO) {
  //   return this.walletService.donate(userId, body)
  // }

  @Get('transactions')
  @UseGuards(AccessAuthGuard)
  async getTransactions(
    @ActiveUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(userId, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20)
  }
}
