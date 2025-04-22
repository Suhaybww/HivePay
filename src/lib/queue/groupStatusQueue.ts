// src/lib/queue/groupStatusQueue.ts
import Bull from 'bull';
import { bullOptions, defaultJobOptions } from './config';

export const groupStatusQueue = new Bull('group-status', {
  ...bullOptions,
  defaultJobOptions
});