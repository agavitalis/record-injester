import { Prop } from '@nestjs/mongoose';
import { Status } from '../enums/status.enum';
import { Types } from 'mongoose';

export class BaseEntity {
  _id: Types.ObjectId;

  @Prop({
    enum: [Status.ACTIVE, Status.DISABLED, Status.DELETED],
    default: Status.ACTIVE,
  })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date;
}

