import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  VideoMetadata,
  VideoMetadataDocument,
} from '../../schemas/metadata.schema';

type IncomingPayload = {
  video: { fileName: string; url?: string; duration?: string };
  thumbnail?: { url?: string };
  title: string;
  instructor?: string;
  estimatedTime?: string;
  summary?: string;
  description?: string;
  category?: {
    majorId?: string;
    middleId?: string;
    minorId?: string;
    path?: string[];
  };
  tags?: string[];
  announcement?: string;
  uploadedAt?: string; // ISO from client
};

@Controller('api/HttpExample/mongodb/metadata')
export class MetadataController {
  constructor(
    @InjectModel(VideoMetadata.name)
    private readonly metadataModel: Model<VideoMetadataDocument>,
  ) {}

  @Post()
  async create(@Body() body: IncomingPayload) {
    try {
      if (!body || !body.video || !body.video.fileName || !body.title) {
        throw new HttpException(
          'title and video.fileName are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const doc = new this.metadataModel({
        video: {
          fileName: body.video.fileName,
          url: body.video.url ?? '',
          duration: body.video.duration ?? '',
        },
        thumbnail: body.thumbnail?.url
          ? { url: body.thumbnail.url }
          : undefined,
        title: body.title,
        instructor: body.instructor ?? '',
        estimatedTime: body.estimatedTime ?? '',
        summary: body.summary ?? '',
        description: body.description ?? '',
        category: body.category
          ? {
              majorId: body.category.majorId,
              middleId: body.category.middleId,
              minorId: body.category.minorId,
              path: Array.isArray(body.category.path) ? body.category.path : [],
            }
          : undefined,
        tags: Array.isArray(body.tags) ? body.tags : [],
        announcement: body.announcement ?? '',
        uploadedAt: body.uploadedAt ? new Date(body.uploadedAt) : new Date(),
      });

      await doc.save();
      return { success: true, id: doc._id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: '保存に失敗しました', detail: (error as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async list(
    @Query('majorId') majorId?: string,
    @Query('middleId') middleId?: string,
    @Query('minorId') minorId?: string,
  ) {
    const conditions: Record<string, unknown> = {};
    if (majorId) conditions['category.majorId'] = majorId;
    if (middleId) conditions['category.middleId'] = middleId;
    if (minorId) conditions['category.minorId'] = minorId;

    const items = await this.metadataModel
      .find(conditions, { __v: 0 })
      .sort({ createdAt: -1 })
      .lean();
    return { items };
  }

  @Get(':id')
  async getById(@Param('id') idParam: string) {
    if (!idParam) {
      throw new HttpException('id is required', HttpStatus.BAD_REQUEST);
    }
    const decoded = this.decodeBase64UrlSafe(idParam) || idParam;
    const doc =
      (await this.metadataModel.findById(decoded, { __v: 0 }).lean()) ||
      (await this.metadataModel.findById(idParam, { __v: 0 }).lean());
    if (!doc) {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }
    return doc;
  }

  @Put(':id')
  async updateById(
    @Param('id') idParam: string,
    @Body() body: IncomingPayload,
  ) {
    if (!idParam) {
      throw new HttpException('id is required', HttpStatus.BAD_REQUEST);
    }
    // Build update payload; do not allow overwriting with undefined
    const $set: Record<string, unknown> = {};
    if (body.title !== undefined) $set['title'] = body.title;
    if (body.instructor !== undefined) $set['instructor'] = body.instructor;
    if (body.estimatedTime !== undefined)
      $set['estimatedTime'] = body.estimatedTime;
    if (body.summary !== undefined) $set['summary'] = body.summary;
    if (body.description !== undefined) $set['description'] = body.description;
    if (body.tags !== undefined)
      $set['tags'] = Array.isArray(body.tags) ? body.tags : [];
    if (body.announcement !== undefined)
      $set['announcement'] = body.announcement;
    if (body.uploadedAt !== undefined)
      $set['uploadedAt'] = body.uploadedAt
        ? new Date(body.uploadedAt)
        : undefined;
    if (body.video !== undefined) {
      const v: Record<string, unknown> = {};
      if (body.video.fileName !== undefined)
        v['fileName'] = body.video.fileName;
      if (body.video.url !== undefined) v['url'] = body.video.url;
      if (body.video.duration !== undefined)
        v['duration'] = body.video.duration;
      $set['video'] = v;
    }
    if (body.thumbnail !== undefined) {
      const t: Record<string, unknown> = {};
      if (body.thumbnail.url !== undefined) t['url'] = body.thumbnail.url;
      $set['thumbnail'] = t;
    }
    if (body.category !== undefined) {
      const c: Record<string, unknown> = {};
      if (body.category.majorId !== undefined)
        c['majorId'] = body.category.majorId;
      if (body.category.middleId !== undefined)
        c['middleId'] = body.category.middleId;
      if (body.category.minorId !== undefined)
        c['minorId'] = body.category.minorId;
      if (body.category.path !== undefined)
        c['path'] = body.category.path ?? [];
      $set['category'] = c;
    }

    const decoded = this.decodeBase64UrlSafe(idParam) || idParam;
    const primary = await this.metadataModel.updateOne(
      { _id: decoded },
      { $set },
    );
    const result = primary.matchedCount
      ? primary
      : await this.metadataModel.updateOne({ _id: idParam }, { $set });
    if (!result.matchedCount) {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  @Delete(':id')
  async deleteById(@Param('id') idParam: string) {
    if (!idParam) {
      throw new HttpException('id is required', HttpStatus.BAD_REQUEST);
    }
    const decoded = this.decodeBase64UrlSafe(idParam) || idParam;
    const primary = await this.metadataModel.deleteOne({ _id: decoded });
    const result = primary.deletedCount
      ? primary
      : await this.metadataModel.deleteOne({ _id: idParam });
    if (!result.deletedCount) {
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }
    return { success: true, deletedCount: result.deletedCount };
  }

  /** URL-safe Base64 をデコード（失敗時は空文字を返す） */
  private decodeBase64UrlSafe(input: string): string {
    try {
      const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '==='.slice((normalized.length + 3) % 4);
      return Buffer.from(padded, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
}
