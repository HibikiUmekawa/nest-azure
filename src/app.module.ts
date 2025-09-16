import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CategoryModule } from './mongodb/categories/category.module';
import { MessageModule } from './mongodb/mongodb.module';
import { Video, VideoSchema } from './schemas/video.schema';
import { UploadModule } from './upload.module';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forRoot(process.env.MONGODB_URI!, {
      dbName: 'video-info',
    }),
    MongooseModule,
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    MessageModule,
    CategoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
