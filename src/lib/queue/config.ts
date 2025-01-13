// src/lib/queue/config.ts
import Bull from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const contributionQueue = new Bull('contribution-cycles', REDIS_URL);

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
};

export { defaultJobOptions };
