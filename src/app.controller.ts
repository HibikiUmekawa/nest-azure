import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedFileData } from './storage.service';

@Controller('api/HttpExample')
export class AppController {
  private readonly blobServiceClient: BlobServiceClient;

  constructor() {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!,
    );
  }

  /** 動作確認用 */
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  /** アップロード */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: UploadedFileData) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const containerClient = this.blobServiceClient.getContainerClient('videos');
    await containerClient.createIfNotExists();

    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer);

    // アップロード直後に視聴用SASを生成
    const sasUrl = this.generateSasUrl(blobName);

    return {
      fileName: blobName,
      url: sasUrl, // すぐ再生できるSAS付きURL
    };
  }

  /** 既存ファイルのSAS取得 */
  @Get('video-sas/:fileName')
  async getVideoSas(@Param('fileName') fileName: string) {
    const containerClient = this.blobServiceClient.getContainerClient('videos');
    const blobClient = containerClient.getBlobClient(fileName);

    const exists = await blobClient.exists();
    if (!exists) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    const sasUrl = this.generateSasUrl(fileName);
    return { url: sasUrl };
  }

  /** 内部メソッド: SAS URLを生成 */
  private generateSasUrl(fileName: string): string {
    const containerName = 'videos';
    const blobClient = this.blobServiceClient
      .getContainerClient(containerName)
      .getBlobClient(fileName);

    const sharedKeyCredential = new StorageSharedKeyCredential(
      process.env.AZURE_STORAGE_ACCOUNT_NAME!,
      process.env.AZURE_STORAGE_ACCOUNT_KEY!,
    );

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName: fileName,
        expiresOn: new Date(new Date().valueOf() + 10 * 60 * 1000), // 10分有効
        permissions: BlobSASPermissions.parse('r'), // 読み取りのみ
      },
      sharedKeyCredential,
    ).toString();

    return `${blobClient.url}?${sas}`;
  }
}
