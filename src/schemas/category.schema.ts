import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'categories' }) // コレクション名を明示
export class Category {
  @Prop({ required: true })
  _id: string; // cat001 など

  @Prop({ required: true })
  orgId: string; // org001 など

  @Prop({ required: true })
  name: string; // "大分類A"

  @Prop({ required: true, enum: ['major', 'middle', 'minor'] })
  type: string; // major, middle, minor

  @Prop({ default: null })
  parentId: string; // 親カテゴリの _id（大分類なら null）

  @Prop({ type: [String], required: true })
  path: string[]; // ["cat001"], ["cat001", "cat002"] など
}

export type CategoryDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);
