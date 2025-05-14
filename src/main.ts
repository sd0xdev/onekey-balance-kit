import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

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

  app.enableCors(); // 允許跨域請求
  app.setGlobalPrefix('v1'); // API版本前綴
  await app.listen(3000);
  console.log(`OneKeyBalanceKit 正在運行，訪問: http://localhost:3000/v1/`);
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
