import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../../schemas/category.schema';

@Controller('api/HttpExample/mongodb/categories')
export class CategoryController {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  /** 新しいカテゴリを追加 */
  @Post()
  async createCategory(@Body() body: Partial<Category>) {
    try {
      if (!body._id || !body.name || !body.type || !body.orgId) {
        throw new HttpException(
          '必須項目が不足しています',
          HttpStatus.BAD_REQUEST,
        );
      }

      const category = new this.categoryModel({
        _id: body._id,
        orgId: body.orgId,
        name: body.name,
        type: body.type,
        parentId: body.parentId ?? null,
        path: body.path ?? [body._id],
      });

      await category.save();
      return { success: true, category };
    } catch (error) {
      throw new HttpException(
        { message: '保存に失敗しました', detail: (error as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** 大分類一覧 */
  @Get('major')
  async listMajor() {
    const items = await this.categoryModel
      .find({ type: 'major' }, { __v: 0 })
      .sort({ name: 1 })
      .lean();
    return { items };
  }

  /** 中分類一覧 */
  @Get('middle')
  async listMiddle() {
    const items = await this.categoryModel
      .find({ type: 'middle' }, { __v: 0 })
      .sort({ name: 1 })
      .lean();
    return { items };
  }

  /** 指定の大分類IDを含む中分類一覧 */
  @Get('middle/:majorId')
  async listMiddleByMajor(@Param('majorId') majorId: string) {
    if (!majorId) {
      throw new HttpException('majorId is required', HttpStatus.BAD_REQUEST);
    }
    const items = await this.categoryModel
      .find({ type: 'middle', path: majorId }, { __v: 0 })
      .sort({ name: 1 })
      .lean();
    return { items };
  }

  /** 小分類一覧 */
  @Get('minor')
  async listMinor() {
    const items = await this.categoryModel
      .find({ type: 'minor' }, { __v: 0 })
      .sort({ name: 1 })
      .lean();
    return { items };
  }

  /** 指定の大分類ID・中分類IDを含む小分類一覧 */
  @Get('minor/:majorId/:middleId')
  async listMinorByParents(
    @Param('majorId') majorId: string,
    @Param('middleId') middleId: string,
  ) {
    if (!majorId || !middleId) {
      throw new HttpException(
        'majorId and middleId are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const items = await this.categoryModel
      .find({ type: 'minor', path: { $all: [majorId, middleId] } }, { __v: 0 })
      .sort({ name: 1 })
      .lean();
    return { items };
  }

  /** 指定IDのカテゴリを削除 */
  @Delete(':id')
  async deleteById(@Param('id') idParam: string) {
    if (!idParam) {
      throw new HttpException('id is required', HttpStatus.BAD_REQUEST);
    }
    // Base64(URL-safe) を受け取り、デコードしたIDで削除を試行。失敗したら生値でも試行。
    const decoded = this.decodeBase64UrlSafe(idParam) || idParam;
    const primary = await this.categoryModel.deleteOne({ _id: decoded });
    const result = primary.deletedCount
      ? primary
      : await this.categoryModel.deleteOne({ _id: idParam });
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
