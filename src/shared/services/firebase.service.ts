import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name)

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get<string>('firebase.projectId'),
          clientEmail: this.configService.get<string>('firebase.clientEmail'),
          privateKey: this.configService.get<string>('firebase.privateKey')?.replace(/\\n/g, '\n'),
        }),
      })
      this.logger.log('Firebase Admin initialized')
    }
  }

  verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return admin.auth().verifyIdToken(idToken)
  }

  async sendPushNotification(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!tokens || tokens.length === 0) return null

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: data || {},
      }

      const response = await admin.messaging().sendEachForMulticast(message)

      if (response.failureCount > 0) {
        response.responses.forEach((resp) => {
          if (!resp.success) {
            this.logger.debug(`FCM send failed for token: ${resp.error?.message || 'Unknown error'}`)
          }
        })
      }

      this.logger.log(`FCM sent: ${response.successCount} successes, ${response.failureCount} failures`)
      return response
    } catch (error) {
      this.logger.error('Error sending FCM message', error)
      return null
    }
  }
}
