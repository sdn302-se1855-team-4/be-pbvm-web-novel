import { Module } from '@nestjs/common'
import { WalletController } from './wallet.controller'
import { WalletService } from './wallet.service'
import { PayosService } from 'src/shared/services/payos.service'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [NotificationModule],
  controllers: [WalletController],
  providers: [WalletService, PayosService],
  exports: [WalletService],
})
export class WalletModule {}
