// src/lib/queue/paymentQueue.ts

import Bull from 'bull';

// This is your "payment" or "retry" queue
export const paymentQueue = new Bull('payment-queue', {
  redis: {
    port: Number(process.env.REDIS_PORT || 6379),
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
  },
});

// OPTIONAL: default job options
export const defaultPaymentJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // or any default
  },
  removeOnComplete: true,
  removeOnFail: false,
};
