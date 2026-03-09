import { Module } from '@nestjs/common'
import { WalletController } from './wallet.controller'
import { WalletService } from './wallet.service'
import { PayosService } from 'src/shared/services/payos.service'

@Module({
  controllers: [WalletController],
  providers: [WalletService, PayosService],
  exports: [WalletService],
})
export class WalletModule {}
