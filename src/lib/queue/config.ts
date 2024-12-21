import Bull from 'bull';

// Configure Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create queues for different job types
export const contributionQueue = new Bull('contribution-cycles', REDIS_URL);
export const payoutQueue = new Bull('payout-processing', REDIS_URL);

// Common configuration for Bull queues
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000 // Initial delay of 1 second
  },
  removeOnComplete: true
};

export { defaultJobOptions };