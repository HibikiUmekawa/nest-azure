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
  Query as QueryParam,
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
    if (!conn)
      throw new Error('AZURE_STORAGE_CONNECTION_STRING が未設定です。');
    this.blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    this.sharedKey = getSharedKeyFromConnString(conn);
  }

  /** 動作確認用（?list=videos で一覧を返す） */
  @Get()
  async getHello(
    @QueryParam('list') list?: string,
    @QueryParam('page') pageQ?: string,
    @QueryParam('limit') limitQ?: string,
    @QueryParam('q') q?: string,
    @QueryParam('debug') debugQ?: string,
  ) {
    if (list !== 'videos') return 'Hello World!';

    // debug=1 のときは接続DBと件数だけ返す
    if (debugQ === '1') {
      const dbName = 'test'; // 例: "test" or "videos"
      const collection = this.videoModel.collection.collectionName; // 例: "videos"
      const count = await this.videoModel.estimatedDocumentCount();
      return { dbName, collection, count };
    }

    const page = Math.max(1, parseInt(pageQ ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitQ ?? '20', 10) || 20),
    );
    const skip = (page - 1) * limit;

    const filter =
      q && q.trim()
        ? { originalName: { $regex: q.trim(), $options: 'i' } }
        : {};

    const projection = {
      _id: 0,
      fileName: 1,
      originalName: 1,
      contentType: 1,
      uploadedAt: 1,
    } as const;

    const docs = await this.videoModel
      .find(filter, projection)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = docs.map((d) => ({
      ...d,
      url: this.generateSasUrl(d.fileName),
    }));
    console.log('items', items);
    console.log('itemsaa');

    return { items, page, limit, hasMore: docs.length === limit };
  }

  /** （将来用の）サブパス版。function.json をワイルドカード化したら有効になります */
  @Get('videos')
  async listVideos() {
    const docs = await this.videoModel
      .find(
        {},
        { fileName: 1, originalName: 1, contentType: 1, uploadedAt: 1, _id: 0 },
      )
      .sort({ uploadedAt: -1 })
      .limit(20)
      .lean();

    return docs.map((d) => ({
      ...d,
      url: this.generateSasUrl(d.fileName),
    }));
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

      return { fileName: blobName, url: sasUrl };
    } catch (error: unknown) {
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
    if (!exists)
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);

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
        startsOn: new Date(Date.now() - 60 * 1000),
        expiresOn: new Date(Date.now() + 60 * 60 * 1000), // SAS有効期限60分
      },
      this.sharedKey,
    ).toString();

    return `${blobClient.url}?${sas}`;
  }

  /** サムネイルアップロード */
  @Post('upload-thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(@UploadedFile() file: UploadedFileData) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const thumbContainer = 'thumbnails';
    const containerClient =
      this.blobServiceClient.getContainerClient(thumbContainer);
    await containerClient.createIfNotExists({
      access: 'blob', // ← ここで「匿名公開: Blob」設定をコード側からも可能
    });

    const blobName = sanitizeBlobName(file.originalname ?? 'thumbnail.png');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || 'image/png',
      },
    });

    // 公開 URL をそのまま返す
    return { url: blockBlobClient.url };
  }
}
