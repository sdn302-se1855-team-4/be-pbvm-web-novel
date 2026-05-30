import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { DepositBodyType, PurchaseChapterBodyType, DonateBodyType, WithdrawBodyType } from './wallet.dto'
import { PayosService } from 'src/shared/services/payos.service'
import { NotificationService } from '../notification/notification.service'

const VND_PER_XU = 1000
const WITHDRAW_FEE_PERCENT = 0.15

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly notificationService: NotificationService,
  ) {}

  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId } })
    }
    return wallet
  }

  async createDepositLink(userId: string, body: DepositBodyType) {
    const xu = body.packageVnd / VND_PER_XU
    const orderCode = Date.now() % 2147483647

    const wallet = await this.getWallet(userId)
    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'DEPOSIT',
        amount: xu,
        balance: wallet.balance,
        description: `Nạp ${xu} xu (${body.packageVnd.toLocaleString('vi')}₫) - Đang chờ thanh toán`,
        status: 'PENDING',
        orderCode,
        metadata: JSON.stringify({ packageVnd: body.packageVnd }),
      },
    })

    const frontendUrl = body.returnUrl?.replace(/\/success.*/, '') || 'http://localhost:3001/wallet'
    const paymentLink = await this.payosService.createPaymentLink({
      orderCode,
      amount: body.packageVnd,
      description: `Nap ${xu} xu`,
      returnUrl: `${frontendUrl}/success?orderCode=${orderCode}`,
      cancelUrl: `${frontendUrl}/cancel?orderCode=${orderCode}`,
    })

    return {
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      orderCode,
      xu,
      vnd: body.packageVnd,
    }
  }

  async handlePayosWebhook(webhookBody: Record<string, unknown>) {
    try {
      const webhookData = this.payosService.verifyWebhookData(webhookBody) as Record<string, unknown> | null

      if (webhookData && webhookData.orderCode === 123) {
        this.logger.log('PayOS test webhook received, ignoring')
        return { success: true }
      }

      const orderCode = webhookData?.orderCode as number | undefined
      if (!orderCode) {
        this.logger.warn('Webhook missing orderCode')
        return { success: false }
      }

      const pendingTx = await this.prisma.transaction.findFirst({
        where: { status: 'PENDING', type: 'DEPOSIT', orderCode },
        include: { wallet: true },
      })

      if (!pendingTx) {
        this.logger.warn(`No pending transaction found for orderCode ${orderCode}`)
        return { success: false }
      }

      if (pendingTx.status === 'COMPLETED') {
        return { success: true }
      }

      const xu = pendingTx.amount
      const updated = await this.prisma.wallet.update({
        where: { id: pendingTx.walletId },
        data: { balance: { increment: xu }, totalEarned: { increment: xu } },
      })

      await this.prisma.transaction.update({
        where: { id: pendingTx.id },
        data: {
          status: 'COMPLETED',
          balance: updated.balance,
          description: (pendingTx.description || '').replace('Đang chờ thanh toán', 'Thành công'),
        },
      })

      this.logger.log(`Deposit completed: +${xu} xu for wallet ${pendingTx.walletId}`)
      return { success: true }
    } catch (error) {
      this.logger.error('Webhook processing error:', error)
      return { success: false }
    }
  }

  async verifyDeposit(userId: string, orderCode: number) {
    try {
      const paymentInfo = await this.payosService.getPaymentLinkInfo(orderCode)
      const wallet = await this.getWallet(userId)

      if (paymentInfo.status === 'PAID') {
        const existingTx = await this.prisma.transaction.findFirst({
          where: { walletId: wallet.id, type: 'DEPOSIT', status: 'COMPLETED', orderCode },
        })

        if (!existingTx) {
          const pendingTx = await this.prisma.transaction.findFirst({
            where: { walletId: wallet.id, type: 'DEPOSIT', status: 'PENDING', orderCode },
          })

          if (pendingTx) {
            const xu = pendingTx.amount
            const updated = await this.prisma.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: xu }, totalEarned: { increment: xu } },
            })
            await this.prisma.transaction.update({
              where: { id: pendingTx.id },
              data: {
                status: 'COMPLETED',
                balance: updated.balance,
                description: (pendingTx.description || '').replace('Đang chờ thanh toán', 'Thành công'),
              },
            })
          }
        }

        return { status: 'PAID', message: 'Nạp xu thành công!' }
      }

      return { status: paymentInfo.status, message: 'Giao dịch chưa hoàn tất' }
    } catch {
      return { status: 'ERROR', message: 'Không thể xác minh giao dịch' }
    }
  }

  async cancelDeposit(userId: string, orderCode: number) {
    const wallet = await this.getWallet(userId)
    const pendingTx = await this.prisma.transaction.findFirst({
      where: { walletId: wallet.id, type: 'DEPOSIT', status: 'PENDING', orderCode },
    })

    if (!pendingTx) {
      throw new NotFoundException('Không tìm thấy giao dịch đang chờ để huỷ')
    }

    await this.prisma.transaction.update({
      where: { id: pendingTx.id },
      data: {
        status: 'FAILED',
        description: (pendingTx.description || '').replace('Đang chờ thanh toán', 'Đã huỷ'),
      },
    })

    return { success: true, message: 'Đã huỷ giao dịch thành công' }
  }

  async withdraw(userId: string, body: WithdrawBodyType) {
    const wallet = await this.getWallet(userId)

    if (wallet.balance < body.amount) {
      throw new BadRequestException(`Không đủ xu. Bạn có ${wallet.balance} xu`)
    }

    const vndGross = body.amount * VND_PER_XU
    const fee = Math.floor(vndGross * WITHDRAW_FEE_PERCENT)
    const vndNet = vndGross - fee

    const updated = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: body.amount },
        totalSpent: { increment: body.amount },
      },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'WITHDRAWAL',
        amount: -body.amount,
        balance: updated.balance,
        description: `Rút ${body.amount} xu → ${vndNet.toLocaleString('vi')}₫ (phí 15%: ${fee.toLocaleString('vi')}₫) về ${body.bankName} - ${body.accountNumber}`,
        status: 'PENDING',
        metadata: JSON.stringify({ bankName: body.bankName, accountNumber: body.accountNumber, accountName: body.accountName, vndGross, fee, vndNet }),
      },
    })

    return {
      message: `Yêu cầu rút tiền thành công`,
      balance: updated.balance,
      details: { xu: body.amount, vndGross, fee, vndNet, feePercent: '15%' },
    }
  }

  async purchaseChapter(userId: string, body: PurchaseChapterBodyType) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: body.chapterId },
      include: { story: { select: { authorId: true, title: true } } },
    })
    if (!chapter) throw new NotFoundException('Chương không tồn tại')
    if (!chapter.isPremium) throw new BadRequestException('Chương này miễn phí')
    if (chapter.story.authorId === userId) {
      return { message: 'Bạn là tác giả, không cần mua', alreadyOwned: true }
    }

    const wallet = await this.getWallet(userId)

    // Check existing purchase via chapterId field (not description string search)
    const existingPurchase = await this.prisma.transaction.findFirst({
      where: { walletId: wallet.id, type: 'UNLOCK', chapterId: body.chapterId, status: 'COMPLETED' },
    })
    if (existingPurchase) {
      return { message: 'Bạn đã mua chương này rồi', alreadyOwned: true }
    }

    if (wallet.balance < chapter.price) {
      throw new BadRequestException(`Không đủ xu. Cần ${chapter.price} xu, bạn có ${wallet.balance} xu`)
    }

    const price = chapter.price
    const commission = Math.floor(price * 0.1)
    const authorEarning = price - commission

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: price }, totalSpent: { increment: price } },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'UNLOCK',
        amount: -price,
        balance: updatedWallet.balance,
        description: `Mua chương "${chapter.title}"`,
        status: 'COMPLETED',
        chapterId: body.chapterId,
      },
    })

    const authorWallet = await this.getWallet(chapter.story.authorId)
    const updatedAuthorWallet = await this.prisma.wallet.update({
      where: { id: authorWallet.id },
      data: { balance: { increment: authorEarning }, totalEarned: { increment: authorEarning } },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: authorWallet.id,
        userId: chapter.story.authorId,
        type: 'DEPOSIT',
        amount: authorEarning,
        balance: updatedAuthorWallet.balance,
        description: `Thu nhập từ chương "${chapter.title}" (sau 10% hoa hồng)`,
        status: 'COMPLETED',
        chapterId: body.chapterId,
      },
    })

    await this.prisma.story.update({
      where: { id: chapter.storyId },
      data: { totalEarnings: { increment: authorEarning } },
    })

    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true },
    })
    const buyerName = buyer?.displayName || buyer?.username || 'Một độc giả'

    await this.notificationService.createNotification({
      userId: chapter.story.authorId,
      type: 'SYSTEM',
      title: 'Có người mua chương của bạn',
      message: `${buyerName} vừa mua chương "${chapter.title}" của bộ truyện "${chapter.story.title}". Bạn nhận được ${authorEarning} xu.`,
      link: '/wallet',
    })

    return { message: 'Mua chương thành công', balance: updatedWallet.balance }
  }

  async donate(userId: string, body: DonateBodyType) {
    const receiver = await this.prisma.user.findUnique({ where: { id: body.toUserId } })
    if (!receiver) throw new NotFoundException('Người nhận không tồn tại')

    const wallet = await this.getWallet(userId)
    if (wallet.balance < body.amount) {
      throw new BadRequestException(`Không đủ xu. Cần ${body.amount} xu, bạn có ${wallet.balance} xu`)
    }

    // Create Donation record first to get donationId
    const donation = await this.prisma.donation.create({
      data: {
        amount: body.amount,
        message: body.message,
        fromUserId: userId,
        toUserId: body.toUserId,
        storyId: body.storyId,
        isAnonymous: body.isAnonymous,
      },
    })

    const updatedSender = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: body.amount }, totalSpent: { increment: body.amount } },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'DONATE',
        amount: -body.amount,
        balance: updatedSender.balance,
        description: `Ủng hộ ${body.amount} xu`,
        status: 'COMPLETED',
        donationId: donation.id,
      },
    })

    const receiverWallet = await this.getWallet(body.toUserId)
    const updatedReceiver = await this.prisma.wallet.update({
      where: { id: receiverWallet.id },
      data: { balance: { increment: body.amount }, totalEarned: { increment: body.amount } },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: receiverWallet.id,
        userId: body.toUserId,
        type: 'DEPOSIT',
        amount: body.amount,
        balance: updatedReceiver.balance,
        description: `Nhận ủng hộ ${body.amount} xu`,
        status: 'COMPLETED',
        donationId: donation.id,
      },
    })

    if (body.storyId) {
      await this.prisma.story.update({
        where: { id: body.storyId },
        data: { totalEarnings: { increment: body.amount } },
      })
    }

    await this.notificationService.notifyDonationReceived({
      toUserId: body.toUserId,
      amount: body.amount,
      donorId: userId,
      message: body.message,
      isAnonymous: body.isAnonymous,
      storyId: body.storyId,
    })

    return { message: `Ủng hộ ${body.amount} xu thành công`, balance: updatedSender.balance }
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ])

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async hasUnlockedChapter(userId: string, chapterId: string): Promise<boolean> {
    const purchase = await this.prisma.transaction.findFirst({
      where: { userId, type: 'UNLOCK', chapterId, status: 'COMPLETED' },
    })
    return !!purchase
  }
}
