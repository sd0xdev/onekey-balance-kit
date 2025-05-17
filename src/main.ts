import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * 如果環境變量沒有設置，則設置默認的NODE_ENV
 */
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log(`環境變量NODE_ENV未設置，默認使用'development'環境`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 設置全域驗證管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 過濾掉未在DTO中定義的屬性
      transform: true, // 自動轉換類型
      forbidNonWhitelisted: true, // 如果請求包含未定義的屬性則拒絕
      transformOptions: {
        enableImplicitConversion: true, // 允許隱式轉換
      },
    }),
  );

  // 註冊全局HTTP異常過濾器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 設置 Swagger OpenAPI 文檔
  const config = new DocumentBuilder()
    .setTitle('OneKeyBalanceKit API')
    .setDescription('OneKeyBalanceKit 服務 API 文檔')
    .setVersion('1.0')
    .addTag('balances', '餘額查詢相關 API')
    .addTag('chains', '鏈相關 API')
    .addTag('webhooks', 'Webhook 相關 API')
    .addBearerAuth() // 加入 Bearer Token 認證
    .setBasePath('v1/api')
    .addServer('http://localhost:3000/v1/api')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v1/api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.enableCors(); // 允許跨域請求
  app.setGlobalPrefix('/v1/api'); // API版本前綴
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  console.log(`OneKeyBalanceKit 正在運行，訪問: http://localhost:${port}/v1/api`);
  console.log(`API 文檔可在以下地址查看: http://localhost:${port}/v1/api/docs`);
}

// 處理未捕獲的Promise錯誤，防止進程崩潰
process.on('unhandledRejection', (reason: unknown) => {
  console.error(
    'Unhandled Promise Rejection:',
    reason instanceof Error ? reason.message : String(reason),
  );
  // 不拋出錯誤，只記錄
});

// 使用void運算符或添加catch處理
void bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
