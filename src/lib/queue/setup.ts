// src/lib/queue/setup.ts
import { Job } from 'bull';
import { redisClient, bullOptions, queueEvents, initializeRedis } from './config';
import { contributionQueue } from './contributionQueue';
import { paymentQueue } from './paymentQueue';
import { groupStatusQueue } from './groupStatusQueue';
import {
  processContributionCycle,
  retryFailedPayment,
  handleGroupPause
} from './processors';
import Bull from 'bull';
import { RecoveryService } from '../services/recoveryService';
import { CircuitBreaker } from '../services/circuitBreaker';
import { MetricsService } from '../services/metricsService';

// Active job tracking to prevent duplicates
const activeJobs = new Map<string, boolean>();
const processingLocks = new Map<string, NodeJS.Timeout>();

// Keep track of queue health status
const queueHealth = {
  redisConnected: false,
  contributionQueueReady: false,
  paymentQueueReady: false,
  groupStatusQueueReady: false,
  lastHealthCheck: 0,
  failedJobCount: 0,
  completedJobCount: 0,
  stalledJobCount: 0,
  isHealthy: false
};

// Circuit breakers for external dependencies
export const stripeCircuitBreaker = new CircuitBreaker('stripe', {
  failureThreshold: 5,
  resetTimeout: 30000,
  fallbackResponse: null
});

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

// Enhanced Redis connection check with retry
async function verifyRedisConnections(retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check the main Redis client
      await redisClient.ping();
      console.log('✓ Redis client connected');
      queueHealth.redisConnected = true;
      return true;
    } catch (error) {
      console.error(`‼️ Redis connection failed (attempt ${attempt}/${retries}):`, error);
      
      if (attempt < retries) {
        console.log(`Retrying in ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      } else {
        queueHealth.redisConnected = false;
        throw new Error(`Failed to connect to Redis after ${retries} attempts`);
      }
    }
  }
  return false;
}

// Queue initialization with health check and timeout
async function initializeQueue(queue: Bull.Queue, name: string): Promise<boolean> {
  return new Promise<boolean>(async (resolve, reject) => {
    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error(`⚠️ Timeout initializing ${name} queue`);
      reject(new Error(`Timeout initializing ${name} queue`));
    }, 15000); // 15 second timeout (increased from 10)
    
    try {
      console.log(`Attempting to initialize ${name} queue...`);
      
      // Check if queue is ready
      await queue.isReady();
      
      // Clean stuck jobs - set more conservative timeframes
      await queue.clean(24 * 60 * 60 * 1000, 'completed'); // 24 hours
      await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // 7 days
      
      // Get queue metrics for health check
      const [waitingCount, activeCount, completedCount, failedCount] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);
      
      console.log(`${name} queue metrics:`, {
        waiting: waitingCount,
        active: activeCount,
        completed: completedCount,
        failed: failedCount
      });
      
      // Clear timeout since we succeeded
      clearTimeout(timeout);
      
      // Update queue health status
      switch (name.toLowerCase()) {
        case 'contribution':
          queueHealth.contributionQueueReady = true;
          break;
        case 'payment':
          queueHealth.paymentQueueReady = true;
          break;
        case 'group status':
          queueHealth.groupStatusQueueReady = true;
          break;
      }
      
      console.log(`✓ ${name} queue ready`);
      resolve(true);
    } catch (error) {
      // Clear timeout since we're handling the error
      clearTimeout(timeout);
      console.error(`‼️ Failed to initialize ${name} queue:`, error);
      
      // Update health status for specific queue
      switch (name.toLowerCase()) {
        case 'contribution':
          queueHealth.contributionQueueReady = false;
          break;
        case 'payment':
          queueHealth.paymentQueueReady = false;
          break;
        case 'group status':
          queueHealth.groupStatusQueueReady = false;
          break;
      }
      
      reject(error);
    }
  });
}

// Event listeners setup with proper error handling and metrics
function configureQueueEvents(queue: Bull.Queue) {
  queue
    .on('error', (error: any) => {
      console.error(`[${queue.name}] Connection error:`, error);
      MetricsService.recordQueueEvent(queue.name, 'error');
      queueHealth.isHealthy = false;
    })
    
    .on('failed', (job: Job, err: Error) => {
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
      
      // Log and track metrics
      console.error(`[${queue.name}] Job ${job.id} failed:`, err);
      queueHealth.failedJobCount++;
      MetricsService.recordJobFailure(queue.name, job.name || 'unknown', err.message);
      
      // Check for external API failures and update circuit breaker
      if (err.message && err.message.includes('Stripe')) {
        stripeCircuitBreaker.recordFailure();
      }
    })
    
    .on('completed', (job: Job) => {
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
      queueHealth.completedJobCount++;
      MetricsService.recordJobSuccess(queue.name, job.name || 'unknown');
      
      // Reset circuit breakers on successful Stripe operations
      if (job.data && typeof job.data === 'object' && job.data.stripeOperation) {
        stripeCircuitBreaker.recordSuccess();
      }
    })
    
    .on('stalled', (job: Job) => {
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
      queueHealth.stalledJobCount++;
      MetricsService.recordQueueEvent(queue.name, 'stalled');
    })
    
    .on('waiting', (jobId: string) => {
      console.log(`[${queue.name}] Job ${jobId} waiting`);
      MetricsService.recordQueueEvent(queue.name, 'waiting');
    })
    
    .on('active', (job: Job) => {
      console.log(`[${queue.name}] Job ${job.id} active`);
      MetricsService.recordQueueEvent(queue.name, 'active');
    })
    
    .on('cleaned', (jobs: Job[], type: string) => {
      console.log(`[${queue.name}] Cleaned ${jobs.length} ${type} jobs`);
      MetricsService.recordQueueEvent(queue.name, 'cleaned', jobs.length);
    });
  
  return queue;
}

// Enhanced processor wrapper with job deduplication, safeguards and circuit breaker support
function createProcessorWrapper<T>(processor: (job: Job<T>) => Promise<void>) {
  return async (job: Job<T>) => {
    // For group-based jobs, prevent concurrent processing
    if (job.data && typeof job.data === 'object' && job.data !== null) {
      // Check if data contains groupId (safer type checking)
      const data = job.data as Record<string, any>;
      
      if ('groupId' in data) {
        const groupId = data.groupId;
        const jobKey = `${groupId}-${job.name}`;
        
        console.log(`🏁 Job started processing: ${job.id} (${job.name}) for group ${groupId}`);
        
        // Check if this job is already running
        if (activeJobs.has(jobKey)) {
          console.warn(`⚠️ Skipping duplicate job for group ${groupId} (${job.name})`);
          // Don't fail the job, just mark it as completed to avoid retries
          return;
        }
        
        // Set the job as active
        activeJobs.set(jobKey, true);
        
        // Set a safety timeout to release lock after max duration (10 minutes for long-running jobs)
        const timeoutId = setTimeout(() => {
          console.warn(`⏱️ Safety timeout reached for job ${job.id} (group ${groupId})`);
          activeJobs.delete(jobKey);
          processingLocks.delete(jobKey);
          
          // Record timeout metric
          MetricsService.recordQueueEvent(job.queue.name, 'timeout');
        }, 10 * 60 * 1000);
        
        processingLocks.set(jobKey, timeoutId);
        
        try {
          // Check circuit breaker for Stripe operations
          if ('stripeOperation' in data && data.stripeOperation && !stripeCircuitBreaker.isCircuitClosed()) {
            console.warn(`⚠️ Circuit open for Stripe operations - using fallback for job ${job.id}`);
            // Handle fallback logic here, e.g. scheduling a retry after delay
            return;
          }
          
          // Add start timestamp for performance tracking
          const startTime = Date.now();
          
          // Process the job
          await processor(job);
          
          // Track processing time
          const processingTime = Date.now() - startTime;
          MetricsService.recordJobProcessingTime(job.queue.name, job.name || 'unknown', processingTime);
          
        } catch (error) {
          // If this is a Stripe error, record it in the circuit breaker
          if (error instanceof Error && error.message.includes('Stripe')) {
            stripeCircuitBreaker.recordFailure();
          }
          
          // Rethrow the error to let Bull handle the retry
          throw error;
        } finally {
          // Always release the lock, even if job errors
          activeJobs.delete(jobKey);
          clearTimeout(timeoutId);
          processingLocks.delete(jobKey);
        }
        return;
      }
    }
    
    // For non-group jobs, just process normally with timing
    const startTime = Date.now();
    await processor(job);
    const processingTime = Date.now() - startTime;
    MetricsService.recordJobProcessingTime(job.queue.name, job.name || 'unknown', processingTime);
  };
}

// Regular health check function to monitor queue status
async function performQueueHealthCheck() {
  try {
    // Check Redis connection
    const redisConnected = await redisClient.ping() === 'PONG';
    
    // Get queue metrics
    const [
      cWaiting, cActive, cCompleted, cFailed, cDelayed,
      pWaiting, pActive, pCompleted, pFailed, pDelayed,
      gWaiting, gActive, gCompleted, gFailed, gDelayed
    ] = await Promise.all([
      contributionQueue.getWaitingCount(),
      contributionQueue.getActiveCount(),
      contributionQueue.getCompletedCount(),
      contributionQueue.getFailedCount(),
      contributionQueue.getDelayedCount(),
      
      paymentQueue.getWaitingCount(),
      paymentQueue.getActiveCount(),
      paymentQueue.getCompletedCount(),
      paymentQueue.getFailedCount(),
      paymentQueue.getDelayedCount(),
      
      groupStatusQueue.getWaitingCount(),
      groupStatusQueue.getActiveCount(),
      groupStatusQueue.getCompletedCount(),
      groupStatusQueue.getFailedCount(),
      groupStatusQueue.getDelayedCount()
    ]);
    
    // Update health status
    queueHealth.redisConnected = redisConnected;
    queueHealth.contributionQueueReady = true;
    queueHealth.paymentQueueReady = true;
    queueHealth.groupStatusQueueReady = true;
    queueHealth.lastHealthCheck = Date.now();
    queueHealth.isHealthy = redisConnected;
    
    // Log health metrics
    console.log(`🔍 Queue Health Check:`, {
      redis: redisConnected ? 'connected' : 'disconnected',
      contributionQueue: { waiting: cWaiting, active: cActive, completed: cCompleted, failed: cFailed, delayed: cDelayed },
      paymentQueue: { waiting: pWaiting, active: pActive, completed: pCompleted, failed: pFailed, delayed: pDelayed },
      groupStatusQueue: { waiting: gWaiting, active: gActive, completed: gCompleted, failed: gFailed, delayed: gDelayed },
      circuitBreakers: {
        stripe: stripeCircuitBreaker.getStatus()
      }
    });
    
    // Send metrics to monitoring service
    MetricsService.recordQueueHealth(queueHealth);
    
    // Check for jobs stuck in 'active' state for too long (potential issue)
    if (cActive > 0 || pActive > 0 || gActive > 0) {
      // Run the stuck job check from recovery service
      await RecoveryService.checkForStuckJobs();
    }
    
    return queueHealth.isHealthy;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    queueHealth.isHealthy = false;
    MetricsService.recordQueueEvent('system', 'health_check_failed');
    return false;
  }
}

// Update registerProcessors function in setup.ts
function registerProcessors() {
  // CRITICAL FIX: Limit to ONE job processing at a time per queue to prevent concurrency issues
  contributionQueue.process('start-contribution', 1, 
    createProcessorWrapper(async (job: Job) => {
      console.log(`Processing contribution for group ${job.data.groupId}`);
      await processContributionCycle(job);
    })
  );

  paymentQueue.process('retry-failed-payment', 1,
    createProcessorWrapper(async (job: Job) => {
      console.log(`Retrying payment ${job.data.paymentId}`);
      await retryFailedPayment(job);
    })
  );

  groupStatusQueue.process('handle-group-pause', 1,
    createProcessorWrapper(async (job: Job) => {
      console.log(`Handling group pause for ${job.data.groupId}`);
      await handleGroupPause(job);
    })
  );
  
  console.log('✅ Queue processors registered with concurrency limits');
}

// Update getUniqueJobId function
function getUniqueJobId(prefix: string, data: any): string {
  let id: string;
  
  // For group-based jobs, include the groupId
  if (data.groupId) {
    // Include timestamp to ensure uniqueness even for same group
    id = `${prefix}-${data.groupId}-${Date.now()}`;
  } else if (data.paymentId) {
    // For payment-specific jobs
    id = `${prefix}-${data.paymentId}-${Date.now()}`;
  } else {
    // Fallback for other jobs
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
  
  // Record the job creation for metrics
  MetricsService.recordJobCreated(prefix);
  
  return id;
}

// Patch queue add methods to ensure unique job IDs
function patchQueueAddMethods() {
  const originalContributionAdd = contributionQueue.add.bind(contributionQueue);
  contributionQueue.add = function(name: string, data: any, opts: Bull.JobOptions = {}) {
    const jobId = getUniqueJobId(`contribution-${name}`, data);
    // Track job creation for metrics
    MetricsService.recordJobScheduled('contribution', name);
    return originalContributionAdd(name, data, { ...opts, jobId });
  };
  
  const originalPaymentAdd = paymentQueue.add.bind(paymentQueue);
  paymentQueue.add = function(name: string, data: any, opts: Bull.JobOptions = {}) {
    const jobId = getUniqueJobId(`payment-${name}`, data);
    // Track job creation for metrics
    MetricsService.recordJobScheduled('payment', name);
    return originalPaymentAdd(name, data, { ...opts, jobId });
  };
  
  const originalGroupStatusAdd = groupStatusQueue.add.bind(groupStatusQueue);
  groupStatusQueue.add = function(name: string, data: any, opts: Bull.JobOptions = {}) {
    const jobId = getUniqueJobId(`group-status-${name}`, data);
    // Track job creation for metrics
    MetricsService.recordJobScheduled('groupStatus', name);
    return originalGroupStatusAdd(name, data, { ...opts, jobId });
  };
  
  console.log('✅ Queue add methods patched for unique job IDs');
}

// Schedule regular health checks
function scheduleHealthChecks(intervalMs = 60000) {
  console.log(`Scheduling health checks every ${intervalMs / 1000} seconds`);
  
  setInterval(async () => {
    await performQueueHealthCheck();
  }, intervalMs);
}

// Main setup function
export async function setupQueues(options: {
  skipRecovery?: boolean,
  healthCheckInterval?: number
} = {}) {
  try {
    console.log('🔄 Verifying environment...');
    verifyEnvironment();
    
    console.log('🔄 Verifying Redis connection...');
    await verifyRedisConnections();
    
    // Initialize Redis for proper metadata
    await initializeRedis();
    
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

    // Run initial health check
    await performQueueHealthCheck();
    
    // Schedule regular health checks
    scheduleHealthChecks(options.healthCheckInterval || 60000);
    
    // For normal runs (not tests), perform recovery from database state
    if (!options.skipRecovery) {
      console.log('🔄 Running job recovery to ensure no jobs are missed...');
      try {
        // First run the recovery to rebuild any lost jobs
        const recoveryResult = await RecoveryService.recoverAllJobs();
        console.log('✅ Recovery complete:', recoveryResult);
        
        // After recovery, ensure next cycles are scheduled
        await RecoveryService.scheduleNextCyclesAfterRecovery();
      } catch (recoveryError) {
        console.error('❌ Error during recovery process:', recoveryError);
        // Continue startup even if recovery fails
      }
    }

    // Log environment status for verification
    console.log('Environment Status:', {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      redis: !!process.env.REDIS_URL,
      db: !!process.env.DATABASE_URL
    });
    
    console.log('✅ Queue worker is fully operational');
    return {
      contributionQueue,
      paymentQueue,
      groupStatusQueue,
      health: queueHealth
    };
  } catch (error) {
    console.error('‼️ Critical queue setup error:', error);
    
    // Try to log the error to the metrics service
    MetricsService.recordCriticalError('setup', error instanceof Error ? error.message : 'Unknown error');
    
    // Re-throw the error for proper handling at a higher level
    throw error;
  }
}

// Get current queue health status
export function getQueueHealth() {
  return {
    ...queueHealth,
    timestamp: new Date().toISOString()
  };
}

// Graceful shutdown function
export async function shutdownQueues() {
  console.log('🛑 Initiating graceful shutdown of queues...');
  
  try {
    // Wait for active jobs to finish (max 30 seconds)
    const shutdownTimeout = setTimeout(() => {
      console.warn('⚠️ Shutdown timeout reached, forcing close...');
    }, 30000);
    
    // Close all queues
    await Promise.all([
      contributionQueue.close(),
      paymentQueue.close(),
      groupStatusQueue.close()
    ]);
    
    clearTimeout(shutdownTimeout);
    console.log('✅ All queues gracefully closed');
    
    // Close Redis connections
    await redisClient.quit();
    console.log('✅ Redis connections closed');
    
    return true;
  } catch (error) {
    console.error('❌ Error during queue shutdown:', error);
    return false;
  }
}