import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';

export interface UploadedFileData {
  originalname?: string;
  mimetype?: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class StorageService {
  private readonly blobService: BlobServiceClient;
  private readonly containerName: string;

  constructor() {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is missing');
    this.blobService = BlobServiceClient.fromConnectionString(conn);
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'videos';
  }

  private async getContainer() {
    const container = this.blobService.getContainerClient(this.containerName);
    // 本番は infra 側で作成しておくのが推奨。開発中は createIfNotExists でもOK。
    await container.createIfNotExists();
    return container;
  }

  async uploadBuffer(file: UploadedFileData) {
    const container = await this.getContainer();

    const safeExt = extname(file.originalname || '').toLowerCase() || '.bin';
    const blobName = `${crypto.randomUUID()}${safeExt}`;
    const block = container.getBlockBlobClient(blobName);

    // 小〜中サイズ向け（~数百MB）。巨大ファイルなら uploadStream を使う。
    await block.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || 'application/octet-stream',
      },
    });

    // 公開コンテナなら、そのままURLを返せる
    const publicUrl = block.url;

    // プライベート運用なら SAS を返す（READのみ、60分有効の例）
    // 接続文字列からアカウント名＆キーを取り出してSAS生成
    // ※ 必要なときだけ下記を有効化
    /*
    const accountName = (process.env.AZURE_STORAGE_CONNECTION_STRING || '')
      .match(/AccountName=([^;]+)/)?.[1];
    const accountKey = (process.env.AZURE_STORAGE_CONNECTION_STRING || '')
      .match(/AccountKey=([^;]+)/)?.[1];
    if (!accountName || !accountKey) throw new Error('AccountName/Key not found in connection string');

    const cred = new StorageSharedKeyCredential(accountName, accountKey);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'), // 読み取りのみ
        expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 60分
      },
      cred,
    ).toString();
    const sasUrl = `${block.url}?${sas}`;
    */

    return {
      blobName,
      url: publicUrl, // or sasUrl（上のSASを使う場合）
    };
  }

  // 大きいファイルに向いたストリーム版（必要になったら使ってください）
  async uploadStream(file: UploadedFileData) {
    const container = await this.getContainer();
    const ext = extname(file.originalname || '').toLowerCase() || '.bin';
    const blobName = `${crypto.randomUUID()}${ext}`;
    const block = container.getBlockBlobClient(blobName);

    const stream = Readable.from(file.buffer);
    const blockSize = 4 * 1024 * 1024; // 4MB
    const concurrency = 5;

    await block.uploadStream(stream, blockSize, concurrency, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || 'application/octet-stream',
      },
    });

    return { blobName, url: block.url };
  }
}
