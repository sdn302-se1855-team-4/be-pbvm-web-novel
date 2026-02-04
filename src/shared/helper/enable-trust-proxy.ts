import { INestApplication } from '@nestjs/common'
import { Express } from 'express'

export function enableTrustProxy(app: INestApplication) {
  const adapter = app.getHttpAdapter()

  if (adapter.getType() === 'express') {
    const instance = adapter.getInstance() as Express
    instance.set('trust proxy', true)
  }
}
