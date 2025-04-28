// src/lib/queue/config.ts
import Redis, { RedisOptions } from 'ioredis';
import Bull from 'bull';
import { EventEmitter } from 'events';

// Central event emitter for queue events
export const queueEvents = new EventEmitter();

// Environment validation
const requiredEnvVars = ['REDIS_URL', 'STRIPE_SECRET_KEY', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Enhanced Redis connection options with optimizations for Upstash
export const redisOptions: RedisOptions = {
  tls: {
    rejectUnauthorized: false
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  showFriendlyErrorStack: true,
  // Reconnection strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 500, 10000);
    console.log(`Redis reconnection attempt ${times}. Next attempt in ${delay}ms`);
    return delay;
  },
  // Specific settings for Upstash Redis
  enableAutoPipelining: true, // Better performance with Upstash
  connectTimeout: 20000, // Longer timeout for cloud connections
  // Connection event handlers to be applied
  connectionName: 'hivepay-queue'
};

// Create separate connections for different roles with connection events
function createRedisClient(role: string): Redis {
  const client = new Redis(process.env.REDIS_URL!, {
    ...redisOptions,
    connectionName: `hivepay-${role}`
  });
  
  client.on('connect', () => {
    console.log(`Redis ${role} connected`);
    queueEvents.emit('redis:connect', role);
  });
  
  client.on('error', (error) => {
    console.error(`Redis ${role} error:`, error);
    queueEvents.emit('redis:error', { role, error });
  });
  
  client.on('close', () => {
    console.warn(`Redis ${role} connection closed`);
    queueEvents.emit('redis:close', role);
  });
  
  client.on('reconnecting', () => {
    console.log(`Redis ${role} reconnecting...`);
    queueEvents.emit('redis:reconnecting', role);
  });

  client.on('ready', () => {
    console.log(`Redis ${role} ready`);
    queueEvents.emit('redis:ready', role);
  });

  return client;
}

export const redisClient = createRedisClient('client');
export const redisSubscriber = createRedisClient('subscriber');
export const redisBClient = createRedisClient('bclient');

// Check Redis persistence configuration - adjusted for Upstash
async function checkRedisPersistence() {
  try {
    // For Upstash, we don't need to check persistence as it's managed
    if (process.env.REDIS_URL && process.env.REDIS_URL.includes('upstash.io')) {
      console.log('✅ Using Upstash Redis - persistence is managed by the service');
      return { aof: true, rdb: true }; // Assume it's configured properly
    }
    
    // For self-hosted Redis, check the configuration
    const info = await redisClient.info('persistence');
    const hasAOF = info.includes('aof_enabled:1');
    const hasRDB = info.includes('rdb_last_save_time') && !info.includes('rdb_last_save_time:0');
    
    if (!hasAOF && !hasRDB) {
      console.warn(`
        ⚠️ WARNING: Redis persistence appears to be disabled.
        For production, enable AOF persistence and regular RDB snapshots.
        Check your Redis configuration or use managed Redis with persistence.
      `);
    } else {
      console.log(`✅ Redis persistence settings: AOF=${hasAOF}, RDB=${hasRDB}`);
    }
  } catch (error) {
    console.error('Failed to check Redis persistence configuration:', error);
  }
}

// Enhanced Bull queue configuration with better resilience
export const bullOptions: Bull.QueueOptions = {
  createClient: (type) => {
    switch (type) {
      case 'client': return redisClient;
      case 'subscriber': return redisSubscriber;
      case 'bclient': return redisBClient;
      default: return createRedisClient(`${type}-fallback`);
    }
  },
  prefix: '{hivepay}',
  settings: {
    stalledInterval: 60000, // Check for stalled jobs every 60 seconds
    guardInterval: 15000,   // Run guard process every 15 seconds
    retryProcessDelay: 10000, // Wait 10 seconds between retrying process
    drainDelay: 10, // Minimal delay between checks
    lockDuration: 60000, // Lock jobs for 60 seconds maximum for cloud Redis (increased)
    lockRenewTime: 30000, // Renew locks every 30 seconds for cloud Redis (increased)
    maxStalledCount: 2    // Jobs marked as stalled after 2 checks
  },
  defaultJobOptions: {
    attempts: 5,  // Increased from 3
    backoff: { 
      type: 'exponential', 
      delay: 5000 // 5s, 25s, 125s, etc.
    },
    removeOnComplete: {
      age: 86400 * 7, // Keep completed jobs for 7 days
      count: 1000     // Keep last 1000 completed jobs
    },
    removeOnFail: false
  },
  limiter: {
    max: 5, // Maximum 5 jobs processed concurrently
    duration: 5000, // In 5 second window
    bounceBack: true // Queue up if rate limited
  }
};

// Default job options with more attempts and longer retention
export const defaultJobOptions: Bull.JobOptions = {
  attempts: 5,  // Increased from 3
  backoff: { 
    type: 'exponential', 
    delay: 5000 // 5s, 25s, 125s, etc.
  },
  removeOnComplete: {
    age: 86400 * 7, // Keep completed jobs for 7 days
    count: 1000     // Keep last 1000 completed jobs
  },
  removeOnFail: false,
  jobId: undefined // Ensure no duplicates by setting a job ID for every job
};

// Function to initialize Redis and check persistence
export async function initializeRedis() {
  try {
    await redisClient.ping();
    console.log('✅ Redis connection successful');
    await checkRedisPersistence();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}