import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Video, VideoSchema } from './schemas/video.schema';
import { UploadModule } from './upload.module';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
