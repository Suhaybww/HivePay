import Bull from 'bull';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const groupStatusQueue = new Bull('group-status', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true
  }
});