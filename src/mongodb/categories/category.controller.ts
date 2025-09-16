import {
  Body,
  Controller,
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
      if (!body._id || !body.name || !body.type) {
        throw new HttpException(
          '必須項目が不足しています',
          HttpStatus.BAD_REQUEST,
        );
      }

      const category = new this.categoryModel({
        _id: body._id,
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

  /** 指定の大分類IDを含む中分類一覧 */
  @Get('minor/:minorId')
  async listMinorByMajor(@Param('minorId') minorId: string) {
    if (!minorId) {
      throw new HttpException('minorId is required', HttpStatus.BAD_REQUEST);
    }
    const items = await this.categoryModel
      .find({ type: 'minorId', path: minorId }, { __v: 0 })
      .sort({ name: 1 })
      .lean();
    return { items };
  }
}
