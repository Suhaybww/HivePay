import Redis from 'ioredis';
import Bull from 'bull';

// Redis connection options
export const redisOptions = {
  tls: {
    rejectUnauthorized: false
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  showFriendlyErrorStack: true
};

// Create separate connections for different roles
export const redisClient = new Redis(process.env.REDIS_URL!, redisOptions);
export const redisSubscriber = redisClient.duplicate();
export const redisBClient = redisClient.duplicate();

// Bull queue configuration
export const bullOptions: Bull.QueueOptions = {
  createClient: (type) => {
    switch (type) {
      case 'client': return redisClient;
      case 'subscriber': return redisSubscriber;
      case 'bclient': return redisBClient;
      default: return new Redis(process.env.REDIS_URL!, redisOptions);
    }
  },
  prefix: '{hivepay}',
  settings: {
    stalledInterval: 60000, // Increased to 60 seconds
    guardInterval: 15000,   // Increased to 15 seconds
    retryProcessDelay: 10000, // Increased to 10 seconds
    drainDelay: 10, // Minimal delay between checks
    lockDuration: 30000 // Lock jobs for 30 seconds maximum
  },
  limiter: {
    max: 5, // Maximum 5 jobs processed concurrently
    duration: 5000 // In 5 second window
  }
};

// Default job options
export const defaultJobOptions: Bull.JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }, // 5s, 25s, 125s
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24h
    count: 100  // Keep last 100 completed jobs
  },
  removeOnFail: false,
  jobId: undefined // Ensure no duplicates by setting a job ID for every job
};