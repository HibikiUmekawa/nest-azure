import { Controller, Get } from '@nestjs/common';

@Controller('api/HttpExample') // ← Functions 側のパスに合わせる
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}
