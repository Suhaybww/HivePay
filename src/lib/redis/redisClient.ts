// src/lib/redis/redisClient.ts
import Redis, { RedisOptions } from 'ioredis';
import { EventEmitter } from 'events';

// Create a shared event emitter for Redis events
export const redisEvents = new EventEmitter();

// Basic Redis options with safety settings
const baseRedisOptions: RedisOptions = {
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
  // Default connection event handlers
  enableOfflineQueue: true,
  lazyConnect: false
};

// Redis client connection cache to avoid creating multiple connections to the same instance
const clientCache = new Map<string, Redis>();

/**
 * Factory function to create Redis clients with proper connection events
 * This ensures consistent Redis handling across the application
 * 
 * @param role A descriptive role for this Redis client
 * @param config Optional custom Redis options
 * @returns A configured Redis client
 */
export function createRedisClient(role: string, config: RedisOptions = {}): Redis {
  const cacheKey = `${role}-${JSON.stringify(config)}`;
  
  // Check if we already have a client for this role and config
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }
  
  // Create a new client with merged options
  const client = new Redis(process.env.REDIS_URL!, {
    ...baseRedisOptions,
    ...config,
    connectionName: `hivepay-${role}`
  });
  
  // Attach event handlers
  client.on('connect', () => {
    console.log(`Redis ${role} connected`);
    redisEvents.emit('connect', role);
  });
  
  client.on('error', (error) => {
    console.error(`Redis ${role} error:`, error);
    redisEvents.emit('error', { role, error });
  });
  
  client.on('close', () => {
    console.warn(`Redis ${role} connection closed`);
    redisEvents.emit('close', role);
    
    // Remove from cache on close
    clientCache.delete(cacheKey);
  });
  
  client.on('reconnecting', () => {
    console.log(`Redis ${role} reconnecting...`);
    redisEvents.emit('reconnecting', role);
  });
  
  client.on('ready', () => {
    console.log(`Redis ${role} ready`);
    redisEvents.emit('ready', role);
  });
  
  client.on('end', () => {
    console.log(`Redis ${role} connection ended`);
    redisEvents.emit('end', role);
    
    // Remove from cache on end
    clientCache.delete(cacheKey);
  });
  
  // Store in cache
  clientCache.set(cacheKey, client);
  
  return client;
}

/**
 * Check Redis health with timeout
 * @param client Redis client to check
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise resolving to true if healthy, false otherwise
 */
export async function checkRedisHealth(client: Redis, timeoutMs = 5000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // Set timeout
    const timeout = setTimeout(() => {
      console.error(`Redis health check timed out after ${timeoutMs}ms`);
      resolve(false);
    }, timeoutMs);
    
    // Try to ping
    client.ping()
      .then(result => {
        clearTimeout(timeout);
        resolve(result === 'PONG');
      })
      .catch(error => {
        console.error('Redis health check failed:', error);
        clearTimeout(timeout);
        resolve(false);
      });
  });
}

/**
 * Gracefully close all Redis clients
 * @returns Promise resolving when all clients are closed
 */
export async function closeAllRedisClients(): Promise<void> {
  console.log(`Closing ${clientCache.size} Redis clients...`);
  
  const closePromises = Array.from(clientCache.values()).map(client => {
    return client.quit().catch(error => {
      console.error('Error closing Redis client:', error);
    });
  });
  
  await Promise.all(closePromises);
  clientCache.clear();
  console.log('All Redis clients closed');
}

/**
 * Check if Redis persistence is enabled
 * For Upstash, this is simplified since it's managed
 * @param client Redis client to check
 * @returns Promise resolving to an object with AOF and RDB status
 */
export async function checkRedisPersistence(client: Redis): Promise<{ aof: boolean, rdb: boolean }> {
  try {
    // For Upstash, we don't need to check persistence as it's managed
    if (process.env.REDIS_URL && process.env.REDIS_URL.includes('upstash.io')) {
      console.log('✅ Using Upstash Redis - persistence is managed by the service');
      return { aof: true, rdb: true }; // Assume it's configured properly
    }
    
    // For self-hosted Redis, check the configuration
    const info = await client.info('persistence');
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
    
    return { aof: hasAOF, rdb: hasRDB };
  } catch (error) {
    console.error('Failed to check Redis persistence configuration:', error);
    return { aof: false, rdb: false };
  }
}