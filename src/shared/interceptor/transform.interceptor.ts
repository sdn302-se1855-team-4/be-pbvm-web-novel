import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { Reflector } from '@nestjs/core'
import { RESPONSE_MESSAGE_KEY } from '../constants/response.constants'
import { Response } from 'express'

export interface APiResponse<T> {
  data: T
  status: number
  message?: string
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, APiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<APiResponse<T>> {
    const message = this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) || 'success'
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp()
        const response = ctx.getResponse<Response>()
        const status = response.statusCode
        console.log(response)
        return { data, status, message }
      }),
    )
  }
}
