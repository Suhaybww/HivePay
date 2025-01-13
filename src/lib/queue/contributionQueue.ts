// src/lib/queue/contributionQueue.ts

import Bull from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * contributionQueue
 * - Handles “start-contribution” jobs, i.e. the main cycle job.
 */
export const contributionQueue = new Bull('contribution-cycles', REDIS_URL);

/**
 * Optional default job options for contribution cycles.
 */
export const contributionJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
};
