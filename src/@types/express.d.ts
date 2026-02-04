// src/@types/express.d.ts
import { Role } from '@/shared/constants/role.constant'
import 'express'

declare global {
  namespace Express {
    interface User {
      userid: string
      email: string
      role: Role
    }

    interface Request {
      user?: User
    }
  }
}
