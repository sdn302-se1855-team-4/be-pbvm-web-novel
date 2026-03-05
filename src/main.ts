import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common'
import { LoggingInterceptor } from './shared/interceptor/logging.interceptor'
import { TransformInterceptor } from './shared/interceptor/transform.interceptor'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import 'dotenv/config'
async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //tự động loại bỏ các field không được khai báo decorator trong DTO
      forbidNonWhitelisted: true, //nếu field không khai báo decorator trong dto mà client
      // truyền vào thì sẽ báo lỗi
      transform: true, // tự động chuyển hóa dữ liệu sang kiểu dữ liệu
      //  được khai báo trong DTO
      transformOptions: {
        enableImplicitConversion: true, //tự chuyển đổi dữ liệu dc khai báo
      },
      exceptionFactory: (ValidationError) => {
        console.log(ValidationError)

        return new UnprocessableEntityException(
          ValidationError.map((error) => ({
            field: error.property,
            error: Object.values(error.constraints as any).join(', '),
          })),
        )
      },
    }),
  )
  app.useGlobalInterceptors(new LoggingInterceptor())
  app.useGlobalInterceptors(new TransformInterceptor(app.get('Reflector')))

  const config = new DocumentBuilder()
    .setTitle('Work AI Backend API')
    .setDescription('The Work AI Backend API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  const cleanedDocument = cleanupOpenApiDoc(document)
  SwaggerModule.setup('api/docs', app, cleanedDocument)

  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
