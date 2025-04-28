import Bull from 'bull';
import 'dotenv/config';
import path from 'path';
import { setupQueues } from '@/src/lib/queue/setup';
import { contributionQueue } from './src/lib/queue/contributionQueue';
import { paymentQueue } from './src/lib/queue/paymentQueue';
import { groupStatusQueue } from './src/lib/queue/groupStatusQueue';
import { redisClient, redisOptions, bullOptions } from '@/src/lib/queue/config';

// Debug complete Redis configuration
function debugRedisConfiguration() {
  console.log('📊 REDIS CONFIGURATION DETAILS:');
  
  // Safely print Redis URL with credentials partially masked
  const redisUrl = process.env.REDIS_URL || '';
  const maskedUrl = redisUrl.replace(/(redis:\/\/|rediss:\/\/)(.*?)@/g, '$1****@');
  console.log(`Redis URL: ${maskedUrl}`);
  
  // Print Bull queue options (excluding client functions)
  const sanitizedBullOptions = {...bullOptions};
  delete sanitizedBullOptions.createClient; // Remove function for clean logging
  console.log('Bull Options:', JSON.stringify(sanitizedBullOptions, null, 2));
  
  // Print Redis client options
  console.log('Redis Client Options:', JSON.stringify(redisOptions, null, 2));
  
  // Print queue details
  console.log('Queue Names:', {
    contribution: contributionQueue.name,
    payment: paymentQueue.name,
    groupStatus: groupStatusQueue.name
  });
  
  // Print job options
  const defaultJobOpts = require('@/src/lib/queue/config').defaultJobOptions;
  console.log('Default Job Options:', JSON.stringify(defaultJobOpts, null, 2));
}

// Debug environment variables
function debugEnvironmentVariables() {
  console.log('🔍 DEBUG - Environment Variables:');
  
  // Check DATABASE_URL format and structure
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`Database URL: ${dbUrl.substring(0, 20)}...${dbUrl.substring(dbUrl.length - 20)}`);
  
  // Check URL format
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    console.log('✅ Database URL has correct protocol prefix');
  } else {
    console.error('❌ Database URL does not start with postgresql:// or postgres://');
  }
  
  // Check for missing required parts
  const missingParts = [];
  if (!dbUrl.includes('@')) missingParts.push('@ symbol (separates credentials from host)');
  if (!dbUrl.includes('://')) missingParts.push(':// (protocol separator)');
  if (!dbUrl.includes('/')) missingParts.push('/ (database name separator)');
  
  if (missingParts.length > 0) {
    console.error(`❌ Database URL is missing: ${missingParts.join(', ')}`);
  } else {
    console.log('✅ Database URL structure looks valid');
  }

  // Check Stripe key format
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const isValidStripeKey = stripeKey.startsWith('sk_') && stripeKey.length > 10;
  console.log(`Stripe key format valid: ${isValidStripeKey ? '✅' : '❌'}`);
  
  // Check Redis URL
  const redisUrl = process.env.REDIS_URL || '';
  console.log(`Redis URL: ${redisUrl.includes('@') ? redisUrl.split('@')[1] : redisUrl}`);
}

// Verify critical environment variables
const requiredEnv = ['STRIPE_SECRET_KEY', 'DATABASE_URL', 'REDIS_URL'];
requiredEnv.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing ${varName} in environment`);
  }
});

console.log('🚀 Queue worker starting with environment:', {
  stripeKey: process.env.STRIPE_SECRET_KEY?.slice(0, 8) + '...',
  db: process.env.DATABASE_URL?.split('@')[1] || 'missing',
  redis: process.env.REDIS_URL?.split('@')[1] || 'missing'
});

// Debug environment variables
debugEnvironmentVariables();

// Debug Redis configuration
debugRedisConfiguration();

// Test Redis connection
async function testRedisConnection() {
  try {
    await redisClient.ping();
    console.log('✅ Redis connection verified');
    
    // Additional Redis info
    try {
      const info = await redisClient.info();
      console.log('Redis Server Info:', info.split('\n').slice(0, 5).join('\n')); // First 5 lines only
    } catch (infoError) {
      console.warn('Could not get Redis info:', infoError);
    }
  } catch (error) {
    console.error('‼️ Redis connection failed:', error);
    process.exit(1);
  }
}

// Add queue event listeners for debugging
function setupQueueEventListeners() {
  const queues = [contributionQueue, paymentQueue, groupStatusQueue];

  queues.forEach(queue => {
    queue
      .on('active', (job: Bull.Job) => {
        console.log(`🏁 Job ${job.id} started processing (queue: ${queue.name})`);
      })
      .on('completed', (job: Bull.Job) => {
        console.log(`🎉 Job ${job.id} completed successfully (queue: ${queue.name})`);
      })
      .on('failed', (job: Bull.Job, err: Error) => {
        console.error(`💥 Job ${job.id} failed (queue: ${queue.name}):`, err);
        
        // Enhanced error reporting
        if (err.message && err.message.includes('ECONNREFUSED')) {
          const parts = err.message.split(' ');
          const ipAddress = parts[parts.indexOf('ECONNREFUSED') + 1];
          console.error(`🔍 Network error details - Could not connect to: ${ipAddress}`);
          
          // Try to identify the service
          if (ipAddress.includes('172.64.')) {
            console.error('💡 This appears to be a Cloudflare/Stripe API connection issue');
          }
        }
        
        if (err.stack) {
          console.error('🔍 Error stack trace:', err.stack);
        }
      })
      .on('stalled', (job: Bull.Job) => {
        console.warn(`⚠️ Job ${job.id} stalled (queue: ${queue.name})`);
      })
      .on('waiting', (jobId: string) => {
        console.log(`⏳ Job ${jobId} waiting in queue (queue: ${queue.name})`);
      })
      .on('error', (error: Error) => {
        console.error(`‼️ Queue ${queue.name} error:`, error);
      });
  });

  console.log('✅ Queue event listeners configured');
}

// Clean stalled jobs
async function cleanStalledJobs() {
  const queues = [contributionQueue, paymentQueue, groupStatusQueue];
  
  for (const queue of queues) {
    await queue.clean(60000, 'delayed');
    await queue.clean(60000, 'wait');
    await queue.clean(60000, 'active');
    await queue.clean(60000, 'completed');
    console.log(`✅ Cleaned stalled jobs in queue: ${queue.name}`);
  }
}

// Test database connection
async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Import and use Prisma client
    const { db } = require('@/src/db');
    
    try {
      // Just test the connection with a simple query
      await db.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
    } catch (dbError) {
      console.error('❌ Database query failed', dbError);
    }
  } catch (error) {
    console.error('‼️ Database connection test failed:', error);
  }
}

// Clean failed jobs from queue history
async function cleanFailedJobs() {
  const queues = [contributionQueue, paymentQueue, groupStatusQueue];
  
  for (const queue of queues) {
    console.log(`🧹 Cleaning all failed jobs from ${queue.name}...`);
    const removedCount = await queue.clean(0, 'failed'); // 0 = clean all failed jobs regardless of age
    console.log(`✅ Removed ${removedCount} failed jobs from ${queue.name}`);
  }
}

// Main initialization
async function main() {
  try {
    // Test Redis connection
    await testRedisConnection();
    
    // Test database connection
    await testDatabaseConnection();
    
    // Clean stalled jobs
    await cleanStalledJobs();
    await cleanFailedJobs();

    // Initialize queues
    await setupQueues();

    // Set up queue event listeners
    setupQueueEventListeners();

    console.log('✅ Queue worker is fully operational');
    
    // Check queues after 15 seconds
    setTimeout(async () => {
      console.log('🔍 RECHECKING QUEUES AFTER 15 SECONDS:');
      const waitingJobs = await contributionQueue.getJobs(['waiting']);
      const activeJobs = await contributionQueue.getJobs(['active']);
      const completedJobs = await contributionQueue.getJobs(['completed']);
      const failedJobs = await contributionQueue.getJobs(['failed']);
      
      console.log(`Queue status: waiting=${waitingJobs.length}, active=${activeJobs.length}, completed=${completedJobs.length}, failed=${failedJobs.length}`);
      
      if (failedJobs.length > 0) {
        console.log('❌ FAILED JOBS:', failedJobs.map((j: Bull.Job) => ({ 
          id: j.id, 
          data: j.data,
          failedReason: j.failedReason
        })));
      }
    }, 15000);
  } catch (error) {
    console.error('‼️ Failed to initialize queue worker:', error);
    process.exit(1);
  }
}

// Set up graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await Promise.all([
    contributionQueue.close(),
    paymentQueue.close(),
    groupStatusQueue.close()
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await Promise.all([
    contributionQueue.close(),
    paymentQueue.close(),
    groupStatusQueue.close()
  ]);
  process.exit(0);
});

// Start the worker
main().catch(error => {
  console.error('‼️ Unhandled error in queue worker:', error);
  process.exit(1);
});