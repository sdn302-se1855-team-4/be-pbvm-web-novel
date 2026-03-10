import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { DepositBodyType, PurchaseChapterBodyType, DonateBodyType, WithdrawBodyType } from './wallet.dto'
import { PayosService } from 'src/shared/services/payos.service'
import { NotificationService } from '../notification/notification.service'

// Conversion rate: 1000 VND = 1 xu
const VND_PER_XU = 1000
// Admin withdrawal fee: 15%
const WITHDRAW_FEE_PERCENT = 0.15

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly notificationService: NotificationService,
  ) {}

  // Get or create wallet for user
  async getWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId } })
    }
    return wallet
  }

  // Create PayOS payment link for deposit
  async createDepositLink(userId: string, body: DepositBodyType) {
    const xu = body.packageVnd / VND_PER_XU
    const orderCode = Date.now() % 2147483647 // PayOS requires Int32

    // Store pending order in transaction
    const wallet = await this.getWallet(userId)
    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: xu,
        balance: wallet.balance, // balance before
        description: `Nạp ${xu} xu (${body.packageVnd.toLocaleString('vi')}₫) - Đang chờ thanh toán`,
        status: 'PENDING',
        metadata: JSON.stringify({ orderCode, packageVnd: body.packageVnd, userId }),
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

  // Handle PayOS webhook callback
  async handlePayosWebhook(webhookBody: Record<string, unknown>) {
    try {
      const webhookData = this.payosService.verifyWebhookData(webhookBody) as Record<string, unknown> | null

      // Test webhook from PayOS (orderCode = 123)
      if (webhookData && webhookData.orderCode === 123) {
        this.logger.log('PayOS test webhook received, ignoring')
        return { success: true }
      }

      const orderCode = webhookData?.orderCode as number | undefined
      if (!orderCode) {
        this.logger.warn('Webhook missing orderCode')
        return { success: false }
      }

      // Find the pending transaction
      const pendingTx = await this.prisma.transaction.findFirst({
        where: {
          status: 'PENDING',
          type: 'DEPOSIT',
          metadata: { contains: String(orderCode) },
        },
        include: { wallet: true },
      })

      if (!pendingTx) {
        this.logger.warn(`No pending transaction found for orderCode ${String(orderCode)}`)
        return { success: false }
      }

      // Already processed?
      if (pendingTx.status === 'COMPLETED') {
        return { success: true }
      }

      const xu = pendingTx.amount

      // Credit xu to wallet
      const updated = await this.prisma.wallet.update({
        where: { id: pendingTx.walletId },
        data: { balance: { increment: xu } },
      })

      // Mark transaction as completed
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

  // Verify deposit status (called from frontend after redirect)
  async verifyDeposit(userId: string, orderCode: number) {
    try {
      const paymentInfo = await this.payosService.getPaymentLinkInfo(orderCode)
      const wallet = await this.getWallet(userId)

      if (paymentInfo.status === 'PAID') {
        // Check if already credited
        const existingTx = await this.prisma.transaction.findFirst({
          where: {
            walletId: wallet.id,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            metadata: { contains: String(orderCode) },
          },
        })

        if (!existingTx) {
          // Credit xu (fallback if webhook didn't fire)
          const pendingTx = await this.prisma.transaction.findFirst({
            where: {
              walletId: wallet.id,
              type: 'DEPOSIT',
              status: 'PENDING',
              metadata: { contains: String(orderCode) },
            },
          })

          if (pendingTx) {
            const xu = pendingTx.amount
            const updated = await this.prisma.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: xu } },
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

  // Withdraw earned xu (min 200 xu, 15% fee)
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
        type: 'WITHDRAWAL',
        amount: -body.amount,
        balance: updated.balance,
        description: `Rút ${body.amount} xu → ${vndNet.toLocaleString('vi')}₫ (phí 15%: ${fee.toLocaleString('vi')}₫) về ${body.bankName} - ${body.accountNumber}`,
        status: 'PENDING',
      },
    })

    return {
      message: `Yêu cầu rút tiền thành công`,
      balance: updated.balance,
      details: {
        xu: body.amount,
        vndGross,
        fee,
        vndNet,
        feePercent: '15%',
      },
    }
  }

  // Purchase a premium chapter
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

    const existingPurchase = await this.prisma.transaction.findFirst({
      where: {
        walletId: (await this.getWallet(userId)).id,
        type: 'UNLOCK',
        description: { contains: body.chapterId },
        status: 'COMPLETED',
      },
    })
    if (existingPurchase) {
      return { message: 'Bạn đã mua chương này rồi', alreadyOwned: true }
    }

    const wallet = await this.getWallet(userId)
    if (wallet.balance < chapter.price) {
      throw new BadRequestException(`Không đủ xu. Cần ${chapter.price} xu, bạn có ${wallet.balance} xu`)
    }

    const price = chapter.price
    const commission = Math.floor(price * 0.1)
    const authorEarning = price - commission

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: price },
        totalSpent: { increment: price },
      },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'UNLOCK',
        amount: -price,
        balance: updatedWallet.balance,
        description: `Mua chương "${chapter.title}" - ${body.chapterId}`,
        status: 'COMPLETED',
      },
    })

    const authorWallet = await this.getWallet(chapter.story.authorId)
    await this.prisma.wallet.update({
      where: { id: authorWallet.id },
      data: {
        balance: { increment: authorEarning },
        totalEarned: { increment: authorEarning },
      },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: authorWallet.id,
        type: 'DEPOSIT',
        amount: authorEarning,
        balance: authorWallet.balance + authorEarning,
        description: `Thu nhập từ chương "${chapter.title}" (sau 10% hoa hồng)`,
        status: 'COMPLETED',
      },
    })

    // Notify author about the purchase
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

  // Donate to an author
  async donate(userId: string, body: DonateBodyType) {
    if (userId === body.toUserId) {
      throw new BadRequestException('Không thể tặng xu cho chính mình')
    }

    const wallet = await this.getWallet(userId)
    if (wallet.balance < body.amount) {
      throw new BadRequestException(`Không đủ xu. Cần ${body.amount} xu, bạn có ${wallet.balance} xu`)
    }

    const updatedSender = await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: body.amount },
        totalSpent: { increment: body.amount },
      },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'DONATE',
        amount: -body.amount,
        balance: updatedSender.balance,
        description: `Ủng hộ ${body.amount} xu`,
        status: 'COMPLETED',
      },
    })

    const receiverWallet = await this.getWallet(body.toUserId)
    await this.prisma.wallet.update({
      where: { id: receiverWallet.id },
      data: {
        balance: { increment: body.amount },
        totalEarned: { increment: body.amount },
      },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: receiverWallet.id,
        type: 'DEPOSIT',
        amount: body.amount,
        balance: receiverWallet.balance + body.amount,
        description: `Nhận ủng hộ ${body.amount} xu`,
        status: 'COMPLETED',
      },
    })

    await this.prisma.donation.create({
      data: {
        amount: body.amount,
        message: body.message,
        fromUserId: userId,
        toUserId: body.toUserId,
        storyId: body.storyId,
        isAnonymous: body.isAnonymous,
      },
    })

    // Notify the author about the donation
    const donor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true },
    })
    const donorName = body.isAnonymous ? 'Một độc giả ẩn danh' : donor?.displayName || donor?.username || 'Một độc giả'

    await this.notificationService.createNotification({
      userId: body.toUserId,
      type: 'DONATION_RECEIVED',
      title: 'Bạn nhận được ủng hộ',
      message: `${donorName} vừa ủng hộ bạn ${body.amount} xu.${body.message ? ` Lời nhắn: "${body.message}"` : ''}`,
      link: '/wallet',
    })

    return { message: `Ủng hộ ${body.amount} xu thành công`, balance: updatedSender.balance }
  }

  // Get transaction history
  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getWallet(userId)
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { walletId: wallet.id } }),
    ])

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  // Check if user has purchased a chapter
  async hasUnlockedChapter(userId: string, chapterId: string): Promise<boolean> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) return false

    const purchase = await this.prisma.transaction.findFirst({
      where: {
        walletId: wallet.id,
        type: 'UNLOCK',
        description: { contains: chapterId },
        status: 'COMPLETED',
      },
    })
    return !!purchase
  }
}
