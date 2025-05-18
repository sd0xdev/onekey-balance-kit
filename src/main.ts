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
  const app = await NestFactory.create(AppModule, { rawBody: true });

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

  // 配置 CORS
  if (process.env.NODE_ENV === 'production') {
    // 生產環境配置 CORS
    const allowedOrigins = ['https://onekeybalance.sd0.tech', 'https://www.onekeybalance.sd0.tech'];
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }

    app.enableCors({
      origin: (origin, callback) => {
        // 允許特定來源或是請求沒有來源（如某些 SSE 請求）
        if (!origin || allowedOrigins.some((allowedOrigin) => origin.startsWith(allowedOrigin))) {
          callback(null, true);
        } else {
          console.warn(`CORS 請求被拒絕: ${origin} 不在允許的列表中`, allowedOrigins);
          callback(null, false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Cache-Control',
        'Last-Event-ID',
        'X-Requested-With',
      ],
      exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 3600, // 預檢請求結果緩存1小時
    });
    console.log(`CORS 已設置為允許來源: ${allowedOrigins.join(', ')}`);
  } else {
    // 開發環境允許所有來源
    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      credentials: false,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Cache-Control',
        'Last-Event-ID',
        'X-Requested-With',
      ],
      exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
    });
    console.log('CORS 已設置為允許所有來源 (開發環境)');
  }

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
