import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { BullAdapter } from '@bull-board/api/bullAdapter';

@Injectable()
export class BullBoardQueue {}

export const queuePool: Set<Queue> = new Set<Queue>();

export const getBullBoardQueues = () =>
  [...queuePool].map((q) => new BullAdapter(q));
