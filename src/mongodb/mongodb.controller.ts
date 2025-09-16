// src/message.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';

@Controller('api/HttpExample/mongodb')
export class MessageController {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  /** 保存 API */
  @Post()
  async create(@Body('text') text: string) {
    if (!text) {
      return { error: 'text is required' };
    }
    const msg = new this.messageModel({ text });
    await msg.save();
    return { message: 'saved', id: msg._id, text: msg.text };
  }

  /** 確認用に一覧取得 */
  @Get()
  async findAll() {
    return this.messageModel.find().sort({ createdAt: -1 }).limit(10).lean();
  }
}
