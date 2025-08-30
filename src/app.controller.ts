import { BlobServiceClient } from '@azure/storage-blob';
import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedFileData } from './storage.service';

@Controller('api/HttpExample')
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: UploadedFileData) {
    console.log('=== FILE RECEIVED ===', file);
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!,
    );
    const containerClient = blobServiceClient.getContainerClient('videos');
    await containerClient.createIfNotExists();

    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer);

    return { url: blockBlobClient.url };
  }
}
