import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema({ timestamps: true })
export class Video {
  @Prop({ required: true })
  fileName: string; // 保存されたBlob名

  @Prop({ required: true })
  originalName: string; // アップロード時の元ファイル名

  @Prop()
  url: string; // SAS付きURL（必要なら）

  @Prop()
  size: number; // バイトサイズ
}

export const VideoSchema = SchemaFactory.createForClass(Video);
