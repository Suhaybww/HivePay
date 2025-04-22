// src/lib/queue/contributionQueue.ts
import Bull from 'bull';
import { bullOptions, defaultJobOptions } from './config';

export const contributionQueue = new Bull('contribution-cycles', bullOptions);
export const contributionJobOptions = defaultJobOptions;