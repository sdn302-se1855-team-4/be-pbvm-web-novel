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

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now
        console.log(
          `[HTTP] ${res.statusCode} | ${method} ${url} | ${duration}ms | ip=${ip} → ${controller}.${handler}()`,
        )
      }),
      catchError((err) => {
        const duration = Date.now() - now
        console.error(
          `[ERR] ${res.statusCode} | ${method} ${url} | ${duration}ms | ip=${ip} → ${controller}.${handler}()`,
          err,
        )
        return throwError(() => err as Error)
      }),
    )
  }
}
