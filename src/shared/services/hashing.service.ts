import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'

const saltRounds = 10

@Injectable()
export class HashingService {
  async hash(value: string) {
    return await hash(value, saltRounds)
  }
  async compare(value: string, hash: string) {
    return await compare(value, hash)
  }
}
