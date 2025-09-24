import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  VideoMetadata,
  VideoMetadataSchema,
} from '../../schemas/metadata.schema';
import { MetadataController } from './metadata.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VideoMetadata.name, schema: VideoMetadataSchema },
    ]),
  ],
  controllers: [MetadataController],
})
export class MetadataModule {}
