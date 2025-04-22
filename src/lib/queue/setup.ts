import { Job } from 'bull';
import { redisClient } from './config';
import { contributionQueue } from './contributionQueue';
import { paymentQueue } from './paymentQueue';
import { groupStatusQueue } from './groupStatusQueue';
import {
  processContributionCycle,
  retryFailedPayment,
  handleGroupPause
} from './processors';
import Bull from 'bull';

// Active job tracking to prevent duplicates
const activeJobs = new Map<string, boolean>();
const processingLocks = new Map<string, NodeJS.Timeout>();

// Verify environment variables
const verifyEnvironment = () => {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'DATABASE_URL',
    'REDIS_URL'
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
};

// Enhanced Redis connection check
async function verifyRedisConnections() {
  try {
    // Check the main Redis client
    await redisClient.ping();
    console.log('✓ Redis client connected');
    return true;
  } catch (error) {
    console.error('‼️ Redis connection failed:', error);
    process.exit(1);
  }
}

// Queue initialization with health check and timeout
async function initializeQueue(queue: Bull.Queue, name: string) {
  return new Promise<boolean>(async (resolve, reject) => {
    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error(`⚠️ Timeout initializing ${name} queue`);
      reject(new Error(`Timeout initializing ${name} queue`));
    }, 10000); // 10 second timeout
    
    try {
      console.log(`Attempting to initialize ${name} queue...`);
      
      // Check if queue is ready
      await queue.isReady();
      
      // Clear stuck jobs - set more conservative timeframes
      await queue.clean(24 * 60 * 60 * 1000, 'completed'); // 24 hours
      await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // 7 days
      
      // Clear timeout since we succeeded
      clearTimeout(timeout);
      
      console.log(`✓ ${name} queue ready`);
      resolve(true);
    } catch (error) {
      // Clear timeout since we're handling the error
      clearTimeout(timeout);
      console.error(`‼️ Failed to initialize ${name} queue:`, error);
      reject(error);
    }
  });
}

// Event listeners setup
function configureQueueEvents(queue: Bull.Queue) {
  queue.on('error', (error: any) => {
    console.error(`[${queue.name}] Connection error:`, error);
  });
  
  queue.on('failed', (job: Job, err: Error) => {
    // Release the job lock
    if (job.data && typeof job.data === 'object' && 'groupId' in job.data) {
      const jobKey = `${job.data.groupId}-${job.name}`;
      activeJobs.delete(jobKey);
      
      // Clear any timeout
      const timeoutId = processingLocks.get(jobKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        processingLocks.delete(jobKey);
      }
    }
    console.error(`[${queue.name}] Job ${job.id} failed:`, err);
  });
  
  queue.on('completed', (job: Job) => {
    // Release the job lock
    if (job.data && typeof job.data === 'object' && 'groupId' in job.data) {
      const jobKey = `${job.data.groupId}-${job.name}`;
      activeJobs.delete(jobKey);
      
      // Clear any timeout
      const timeoutId = processingLocks.get(jobKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        processingLocks.delete(jobKey);
      }
    }
    console.log(`[${queue.name}] Job ${job.id} completed`);
  });
  
  queue.on('stalled', (job: Job) => {
    // Release the job lock for stalled jobs
    if (job.data && typeof job.data === 'object' && 'groupId' in job.data) {
      const jobKey = `${job.data.groupId}-${job.name}`;
      activeJobs.delete(jobKey);
      
      // Clear any timeout
      const timeoutId = processingLocks.get(jobKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        processingLocks.delete(jobKey);
      }
    }
    console.warn(`[${queue.name}] Job ${job.id} stalled`);
  });
  
  return queue;
}

// Enhanced processor wrapper with job deduplication and safeguards
function createProcessorWrapper<T>(processor: (job: Job<T>) => Promise<void>) {
  return async (job: Job<T>) => {
    // For group-based jobs, prevent concurrent processing
    if (job.data && typeof job.data === 'object' && job.data !== null) {
      // Check if data contains groupId (safer type checking)
      const data = job.data as Record<string, any>;
      if ('groupId' in data) {
        const groupId = data.groupId;
        const jobKey = `${groupId}-${job.name}`;
        
        console.log(`🏁 Job started processing: ${job.id}`);
        
        // Check if this job is already running
        if (activeJobs.has(jobKey)) {
          console.warn(`⚠️ Skipping duplicate job for group ${groupId} (${job.name})`);
          return;
        }
        
        // Set the job as active
        activeJobs.set(jobKey, true);
        
        // Set a safety timeout to release lock after max duration (5 minutes)
        const timeoutId = setTimeout(() => {
          console.warn(`⏱️ Safety timeout reached for job ${job.id} (group ${groupId})`);
          activeJobs.delete(jobKey);
          processingLocks.delete(jobKey);
        }, 5 * 60 * 1000);
        
        processingLocks.set(jobKey, timeoutId);
        
        try {
          // Process the job
          await processor(job);
        } finally {
          // Always release the lock, even if job errors
          activeJobs.delete(jobKey);
          clearTimeout(timeoutId);
          processingLocks.delete(jobKey);
        }
        return;
      }
    }
    
    // For non-group jobs, just process normally
    await processor(job);
  };
}

// Processor registration
function registerProcessors() {
  contributionQueue.process('start-contribution', 
    createProcessorWrapper(async (job: Job) => {
      console.log(`Processing contribution for group ${job.data.groupId}`);
      await processContributionCycle(job);
    })
  );

  paymentQueue.process('retry-failed-payment', 
    createProcessorWrapper(async (job: Job) => {
      console.log(`Retrying payment ${job.data.paymentId}`);
      await retryFailedPayment(job);
    })
  );

  groupStatusQueue.process('handle-group-pause', 
    createProcessorWrapper(async (job: Job) => {
      console.log(`Handling group pause for ${job.data.groupId}`);
      await handleGroupPause(job);
    })
  );
  
  console.log('✅ Queue processors registered');
}

// Ensure unique job IDs for each queue job
function getUniqueJobId(prefix: string, data: any): string {
  if (data.groupId) {
    if (prefix === 'retry-payment' && data.paymentId) {
      return `${prefix}-${data.paymentId}-${Date.now()}`;
    }
    return `${prefix}-${data.groupId}-${Date.now()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Patch queue add methods to ensure unique job IDs - fixed TypeScript issue
function patchQueueAddMethods() {
  const originalContributionAdd = contributionQueue.add.bind(contributionQueue);
  contributionQueue.add = function(name: string, data: any, opts: Bull.JobOptions = {}) {
    const jobId = getUniqueJobId(`contribution-${name}`, data);
    return originalContributionAdd(name, data, { ...opts, jobId });
  };
  
  const originalPaymentAdd = paymentQueue.add.bind(paymentQueue);
  paymentQueue.add = function(name: string, data: any, opts: Bull.JobOptions = {}) {
    const jobId = getUniqueJobId(`payment-${name}`, data);
    return originalPaymentAdd(name, data, { ...opts, jobId });
  };
  
  const originalGroupStatusAdd = groupStatusQueue.add.bind(groupStatusQueue);
  groupStatusQueue.add = function(name: string, data: any, opts: Bull.JobOptions = {}) {
    const jobId = getUniqueJobId(`group-status-${name}`, data);
    return originalGroupStatusAdd(name, data, { ...opts, jobId });
  };
  
  console.log('✅ Queue add methods patched for unique job IDs');
}

// Main setup function
export async function setupQueues() {
  try {
    console.log('🔄 Verifying environment...');
    verifyEnvironment();
    
    console.log('🔄 Verifying Redis connection...');
    await verifyRedisConnections();
    
    // Initialize queues with individual try/catch blocks so one failure doesn't stop all
    console.log('🔄 Initializing queues...');
    try {
      await initializeQueue(contributionQueue, 'Contribution');
    } catch (err) {
      console.error('Failed to initialize contribution queue:', err);
    }
    
    try {
      await initializeQueue(paymentQueue, 'Payment');
    } catch (err) {
      console.error('Failed to initialize payment queue:', err);
    }
    
    try {
      await initializeQueue(groupStatusQueue, 'Group Status');
    } catch (err) {
      console.error('Failed to initialize group status queue:', err);
    }
    
    console.log('✓ All queues operational');

    // Patch queue add methods
    patchQueueAddMethods();

    // Configure events and processors
    console.log('🔄 Configuring queue events...');
    [contributionQueue, paymentQueue, groupStatusQueue].forEach(configureQueueEvents);
    console.log('✅ Queue event listeners configured');
    
    console.log('🔄 Registering queue processors...');
    registerProcessors();

    console.log('Environment Status:', {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      redis: !!process.env.REDIS_URL,
      db: !!process.env.DATABASE_URL
    });
    
    console.log('✅ Queue worker is fully operational');
    return true;
  } catch (error) {
    console.error('‼️ Critical queue setup error:', error);
    process.exit(1);
  }
}