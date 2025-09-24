import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class VideoSubDoc {
  @Prop({ required: true })
  fileName: string;

  @Prop()
  url: string;

  @Prop()
  duration: string; // e.g. "00:42:17" or seconds as string
}

class ThumbnailSubDoc {
  @Prop()
  url: string;
}

class CategorySubDoc {
  @Prop()
  majorId?: string;

  @Prop()
  middleId?: string;

  @Prop()
  minorId?: string;

  @Prop({ type: [String], default: [] })
  path: string[];
}

@Schema({ collection: 'video_metadata', timestamps: true })
export class VideoMetadata {
  @Prop({ type: VideoSubDoc, required: true })
  video: VideoSubDoc;

  @Prop({ type: ThumbnailSubDoc })
  thumbnail?: ThumbnailSubDoc;

  @Prop({ required: true })
  title: string;

  @Prop()
  instructor?: string;

  @Prop()
  estimatedTime?: string;

  @Prop()
  summary?: string;

  @Prop()
  description?: string;

  @Prop({ type: CategorySubDoc })
  category?: CategorySubDoc;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  announcement?: string;

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date;
}

export type VideoMetadataDocument = VideoMetadata & Document;
export const VideoMetadataSchema = SchemaFactory.createForClass(VideoMetadata);
