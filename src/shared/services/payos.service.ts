import { Injectable } from '@nestjs/common'
import { PayOS } from '@payos/node'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class PayosService {
  private payos: any

  constructor(private readonly configService: ConfigService) {
    this.payos = new PayOS({
      clientId: this.configService.get<string>('payos.clientId')!,
      apiKey: this.configService.get<string>('payos.apiKey')!,
      checksumKey: this.configService.get<string>('payos.checksumKey')!,
    })
  }

  async createPaymentLink(params: {
    orderCode: number
    amount: number
    description: string
    returnUrl: string
    cancelUrl: string
    buyerName?: string
    buyerEmail?: string
  }) {
    const paymentData = {
      orderCode: params.orderCode,
      amount: params.amount,
      description: params.description,
      returnUrl: params.returnUrl,
      cancelUrl: params.cancelUrl,
      buyerName: params.buyerName,
      buyerEmail: params.buyerEmail,
      items: [
        {
          name: `Nap ${params.amount / 1000} xu`,
          quantity: 1,
          price: params.amount,
        },
      ],
    }
    return await this.payos.paymentRequests.create(paymentData)
  }

  async getPaymentLinkInfo(orderCode: number) {
    return await this.payos.paymentRequests.get(orderCode)
  }

  verifyWebhookData(body: Record<string, any>) {
    return this.payos.webhooks.verify(body as any)
  }
}
