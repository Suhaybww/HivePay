import dotenv from 'dotenv';
import path from 'path';
import { Job } from 'bull';
import { contributionQueue } from './contributionQueue';
import { paymentQueue } from './paymentQueue';
import { groupStatusQueue } from './groupStatusQueue';
import {
  processContributionCycle,
  retryFailedPayment,
  handleGroupPause
} from './processors';

// Load environment variables from .env.local
dotenv.config({
  path: path.resolve(__dirname, '../../.env.local')
});

// Verify critical environment variables
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'DATABASE_URL',
  'REDIS_URL'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

console.log('Environment variables loaded successfully');

export function setupQueues() {
  // Verify Stripe initialization
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required for payment processing');
  }

  // Configure contribution queue
  contributionQueue.process('start-contribution', async (job: Job) => {
    try {
      console.log(`Processing contribution for group ${job.data.groupId}`);
      await processContributionCycle(job);
    } catch (error) {
      console.error(`Contribution processing failed:`, error);
      throw error;
    }
  });

  // Configure payment retry queue
  paymentQueue.process('retry-failed-payment', async (job: Job) => {
    try {
      console.log(`Retrying payment ${job.data.paymentId}`);
      await retryFailedPayment(job);
    } catch (error) {
      console.error(`Payment retry failed:`, error);
      throw error;
    }
  });

  // Configure group status queue
  groupStatusQueue.process('handle-group-pause', async (job: Job) => {
    try {
      console.log(`Handling group pause for ${job.data.groupId}`);
      await handleGroupPause(job);
    } catch (error) {
      console.error(`Group pause handling failed:`, error);
      throw error;
    }
  });

  // Event listeners for contribution queue
  contributionQueue
    .on('completed', (job) => {
      console.log(`Contribution cycle completed for group ${job.data.groupId}`);
    })
    .on('failed', (job, err) => {
      console.error(`Contribution cycle failed for group ${job.data.groupId}`, err);
    });

  // Event listeners for payment queue
  paymentQueue
    .on('completed', (job) => {
      console.log(`Payment retry completed for payment ${job.data.paymentId}`);
    })
    .on('failed', (job, err) => {
      console.error(`Payment retry failed for payment ${job.data.paymentId}`, err);
    });

  // Event listeners for group status queue
  groupStatusQueue
    .on('completed', (job) => {
      console.log(`Group pause handled for ${job.data.groupId}`);
    })
    .on('failed', (job, err) => {
      console.error(`Failed to handle group pause for ${job.data.groupId}:`, err);
    });

  // Global error handling
  [contributionQueue, paymentQueue, groupStatusQueue].forEach(queue => {
    queue
      .on('error', (error) => {
        console.error(`Queue ${queue.name} connection error:`, error);
      })
      .on('stalled', (job) => {
        console.warn(`Job ${job.id} stalled in ${queue.name}`);
      })
      .on('waiting', (jobId) => {
        console.log(`Job ${jobId} waiting in ${queue.name}`);
      });
  });
  

  console.log('All queues initialized successfully');
  console.log('Current environment:', {
    stripe: !!process.env.STRIPE_SECRET_KEY,
    redis: !!process.env.REDIS_URL,
    db: !!process.env.DATABASE_URL
  });
}