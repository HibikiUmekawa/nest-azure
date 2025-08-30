import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService, type UploadedFileData } from './storage.service';

@Controller('upload') // ← ここが最終パスの末尾になります
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB（必要に応じて調整）
    }),
  )
  async upload(@UploadedFile() file: UploadedFileData) {
    console.log('=== FILE RECEIVED ===', file);
    if (!file) {
      return {
        error: 'file is required (multipart/form-data with field name "file")',
      };
    }
    const result = await this.storage.uploadBuffer(file);
    return { url: result.url, blobName: result.blobName };
  }
}
