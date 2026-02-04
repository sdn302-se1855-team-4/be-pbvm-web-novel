import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Request, Response } from 'express'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now()
    const req = context.switchToHttp().getRequest<Request>()
    const res = context.switchToHttp().getResponse<Response>()
    const method = req.method
    const url = req.url
    const controller = context.getClass().name
    const handler = context.getHandler().name
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip
    console.log(`[REQ] ${method} ${url} | ip=${ip} → ${controller}.${handler}()`)

    return next.handle().pipe(
      tap(() => {
        console.log(`[RES] ${method} ${url} ${res.statusCode} | ip=${ip} -> ${Date.now() - now}ms`)
      }),
      catchError((err) => {
        console.error(`[ERR] ${method} ${url} ${res.statusCode} | ip=${ip} -> ${Date.now() - now}ms`, err)
        return throwError(() => err as Error)
      }),
    )
  }
}
