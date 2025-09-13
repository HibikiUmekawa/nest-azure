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
import { InjectModel } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Model } from 'mongoose';
import { Video, type VideoDocument } from './schemas/video.schema';
import type { UploadedFileData } from './storage.service';

/** 接続文字列からアカウント名・キーを抽出 */
function getSharedKeyFromConnString(conn: string): StorageSharedKeyCredential {
  const parts = Object.fromEntries(
    conn.split(';').map((p) => {
      const idx = p.indexOf('=');
      if (idx === -1) return [p, ''];
      return [p.slice(0, idx), p.slice(idx + 1)];
    }),
  );
  const accountName = parts['AccountName'];
  const accountKey = parts['AccountKey'];
  if (!accountName || !accountKey) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING に AccountName/AccountKey が含まれていません。',
    );
  }
  return new StorageSharedKeyCredential(accountName, accountKey);
}

/** ブロブ名を安全化（先頭/やバックスラッシュを除去、空白をアンダースコア） */
function sanitizeBlobName(original: string): string {
  const justName = original
    .replace(/^([/\\])+/, '')
    .replace(/[/\\]+/g, '_')
    .trim();
  // ブロブ名に使いづらい制御文字などを避ける
  const safe = justName.replace(/\s+/g, '_');
  if (!safe) throw new Error('Invalid blob name');
  return `${Date.now()}-${safe}`;
}

@Controller('api/HttpExample')
export class AppController {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly sharedKey: StorageSharedKeyCredential;
  private readonly containerName = (
    process.env.BLOB_CONTAINER_NAME || 'videos'
  ).toLowerCase();

  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
  ) {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    if (!conn) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING が未設定です。');
    }
    this.blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    this.sharedKey = getSharedKeyFromConnString(conn);
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

    try {
      const containerClient = this.blobServiceClient.getContainerClient(
        this.containerName,
      );
      await containerClient.createIfNotExists();

      const blobName = sanitizeBlobName(file.originalname ?? 'upload.bin');
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Content-Type を付与してアップロード
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype || 'application/octet-stream',
        },
      });

      const sasUrl = this.generateSasUrl(blobName);

      await this.videoModel.create({
        fileName: blobName,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        url: sasUrl,
        uploadedAt: new Date(),
      });

      return {
        fileName: blobName,
        url: sasUrl,
      };
    } catch (error: unknown) {
      // トラブルシュートしやすいよう情報を付与
      throw new HttpException(
        {
          message: 'Upload failed',
          detail: error instanceof Error ? error.message : String(error),
          container: this.containerName,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** 既存ファイルのSAS取得 */
  @Get('video-sas/:fileName')
  async getVideoSas(@Param('fileName') fileName: string) {
    const safe = fileName.replace(/^([/\\])+/, '');
    const containerClient = this.blobServiceClient.getContainerClient(
      this.containerName,
    );
    const blobClient = containerClient.getBlobClient(safe);

    const exists = await blobClient.exists();
    if (!exists) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    const sasUrl = this.generateSasUrl(safe);
    return { url: sasUrl };
  }

  /** 内部メソッド: SAS URLを生成（10分有効・読み取り専用） */
  private generateSasUrl(fileName: string): string {
    const containerClient = this.blobServiceClient.getContainerClient(
      this.containerName,
    );
    const blobClient = containerClient.getBlobClient(fileName);

    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: fileName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 60 * 1000), // 時刻ずれ対策で1分前から有効
        expiresOn: new Date(Date.now() + 10 * 60 * 1000),
      },
      this.sharedKey,
    ).toString();

    return `${blobClient.url}?${sas}`;
  }
}
