import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [StorageService],
})
export class UploadModule {}
