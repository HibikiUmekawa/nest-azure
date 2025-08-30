import { Context, HttpRequest } from '@azure/functions';
import { AzureHttpAdapter } from '@nestjs/azure-func-http';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:5001', // フロント (Next.js 等)
      'http://127.0.0.1:3000',
    ],
    credentials: true, // Cookie, 認証ヘッダを扱う場合
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.init();
  return app;
}

// Azure Functions のエントリーポイント
export default function bootstrap(context: Context, req: HttpRequest): void {
  AzureHttpAdapter.handle(createApp, context, req);
}
