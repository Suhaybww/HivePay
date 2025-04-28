// queueRunner.ts
import 'dotenv/config';
import path from 'path';
import { setupQueues, shutdownQueues } from '@/src/lib/queue/setup';
import { contributionQueue } from './src/lib/queue/contributionQueue';
import { paymentQueue } from './src/lib/queue/paymentQueue';
import { groupStatusQueue } from './src/lib/queue/groupStatusQueue';
import { redisClient } from '@/src/lib/queue/config';
import { RecoveryService } from '@/src/lib/services/recoveryService';
import { MetricsService } from '@/src/lib/services/metricsService';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure logging
const logFile = process.env.LOG_FILE || path.join(logsDir, 'queue.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Redirect console.log and console.error to both console and file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [INFO] ${args.join(' ')}`;
  originalConsoleLog(message);
  logStream.write(message + '\n');
};

console.error = function(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [ERROR] ${args.join(' ')}`;
  originalConsoleError(message);
  logStream.write(message + '\n');
};

// Debug complete Redis configuration
function debugRedisConfiguration() {
  console.log('📊 REDIS CONFIGURATION DETAILS:');
  
  // Safely print Redis URL with credentials partially masked
  const redisUrl = process.env.REDIS_URL || '';
  const maskedUrl = redisUrl.replace(/(redis:\/\/|rediss:\/\/)(.*?)@/g, '$1****@');
  console.log(`Redis URL: ${maskedUrl}`);
  
  // Print database URL
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl) {
    const maskedDbUrl = dbUrl.replace(/(postgresql:\/\/|postgres:\/\/)(.*?)@/g, '$1****@');
    console.log(`Database URL: ${maskedDbUrl}`);
  } else {
    console.error('DATABASE_URL not set');
  }
  
  // Print Node environment
  console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Print hostname for debugging
  try {
    const { hostname } = require('os');
    console.log(`Hostname: ${hostname()}`);
  } catch (error) {
    console.error('Failed to get hostname', error);
  }
}

// Create a crash file with error details
function logCrash(error: Error) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const crashFile = path.join(logsDir, `crash-${timestamp}.log`);
  
  const crashReport = `
==== HivePay Queue Worker Crash Report ====
Time: ${new Date().toISOString()}
Error: ${error.message}
Stack: ${error.stack}
======================================
`;
  
  fs.writeFileSync(crashFile, crashReport);
  console.error(`Crash report written to ${crashFile}`);
}

// Verify critical environment variables
const requiredEnv = ['STRIPE_SECRET_KEY', 'DATABASE_URL', 'REDIS_URL'];
const missingEnv = requiredEnv.filter(varName => !process.env[varName]);

if (missingEnv.length > 0) {
  console.error(`🚨 Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

console.log('🚀 Queue worker starting with environment:', {
  stripeKey: process.env.STRIPE_SECRET_KEY?.slice(0, 8) + '...',
  db: process.env.DATABASE_URL?.includes('@') 
    ? process.env.DATABASE_URL.split('@')[1] 
    : 'missing',
  redis: process.env.REDIS_URL?.includes('@') 
    ? process.env.REDIS_URL.split('@')[1] 
    : 'missing',
  nodeEnv: process.env.NODE_ENV
});

// Debug Redis configuration
debugRedisConfiguration();

// Global state to track worker health
const workerState = {
  startupTime: new Date(),
  isShuttingDown: false,
  healthChecks: 0,
  recoveryRuns: 0,
  lastHealthCheck: null as Date | null,
  isHealthy: false
};

// Run recovery service to check for stuck jobs every 15 minutes
function scheduleRecoveryChecks() {
  console.log('📅 Scheduling regular recovery checks (every 15 minutes)');
  
  setInterval(async () => {
    if (workerState.isShuttingDown) return;
    
    try {
      console.log('🔍 Running scheduled recovery check for stuck jobs');
      const result = await RecoveryService.checkForStuckJobs();
      workerState.recoveryRuns++;
      console.log('✅ Recovery check completed:', result);
    } catch (error) {
      console.error('❌ Scheduled recovery check failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes
}

// Main initialization
async function main() {
  try {
    // Initialize metrics
    MetricsService.init();
    
    console.log('🔄 Starting queue worker initialization...');
    
    // Setup queues with full recovery
    const queues = await setupQueues();
    
    console.log('✅ Queue worker initialization complete!');
    workerState.isHealthy = true;
    
    // Schedule regular health and recovery checks
    scheduleRecoveryChecks();
    
    // Keep the process alive
    process.stdin.resume();
    
    // Check and report queue status every 5 minutes
    setInterval(async () => {
      if (workerState.isShuttingDown) return;
      
      try {
        workerState.healthChecks++;
        workerState.lastHealthCheck = new Date();
        
        // Get queue stats
        const [
          contributionWaiting, contributionActive, contributionDelayed, contributionFailed,
          paymentWaiting, paymentActive, paymentDelayed, paymentFailed,
          groupWaiting, groupActive, groupDelayed, groupFailed
        ] = await Promise.all([
          contributionQueue.getWaitingCount(),
          contributionQueue.getActiveCount(),
          contributionQueue.getDelayedCount(),
          contributionQueue.getFailedCount(),
          
          paymentQueue.getWaitingCount(),
          paymentQueue.getActiveCount(),
          paymentQueue.getDelayedCount(),
          paymentQueue.getFailedCount(),
          
          groupStatusQueue.getWaitingCount(),
          groupStatusQueue.getActiveCount(),
          groupStatusQueue.getDelayedCount(),
          groupStatusQueue.getFailedCount()
        ]);
        
        console.log('📊 Queue status:', {
          contribution: { waiting: contributionWaiting, active: contributionActive, delayed: contributionDelayed, failed: contributionFailed },
          payment: { waiting: paymentWaiting, active: paymentActive, delayed: paymentDelayed, failed: paymentFailed },
          groupStatus: { waiting: groupWaiting, active: groupActive, delayed: groupDelayed, failed: groupFailed },
          uptime: `${Math.floor((Date.now() - workerState.startupTime.getTime()) / 1000 / 60)} minutes`,
          healthChecks: workerState.healthChecks,
          recoveryRuns: workerState.recoveryRuns
        });
        
        // If there are active jobs running for too long, run recovery check
        if (contributionActive > 0 || paymentActive > 0 || groupActive > 0) {
          console.log('🔍 Detected active jobs - checking for stuck jobs');
          await RecoveryService.checkForStuckJobs();
        }
        
        // Log metrics summary
        const metrics = MetricsService.getMetricsSummary();
        console.log('📈 Metrics Summary:', {
          totalJobs: metrics.summary.totalJobs,
          successRate: `${metrics.summary.overallSuccessRate.toFixed(2)}%`,
          queues: metrics.summary.queues,
          isHealthy: metrics.summary.isHealthy
        });
        
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('🏁 Queue worker is now running and processing jobs');
    console.log(`📝 Logs are being written to: ${logFile}`);
    
  } catch (error) {
    console.error('‼️ Failed to initialize queue worker:', error);
    logCrash(error instanceof Error ? error : new Error(String(error)));
    
    // Exit with error code
    process.exit(1);
  }
}

// Set up graceful shutdown
function setupGracefulShutdown() {
  async function shutdown(signal: string) {
    if (workerState.isShuttingDown) return;
    workerState.isShuttingDown = true;
    
    console.log(`🛑 ${signal} received, shutting down gracefully...`);
    
    try {
      // Close all queues
      await shutdownQueues();
      
      // Close file stream
      logStream.end();
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
  
  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    logCrash(error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    logCrash(reason instanceof Error ? reason : new Error(String(reason)));
    shutdown('UNHANDLED_REJECTION');
  });
}

// Setup graceful shutdown handlers
setupGracefulShutdown();

// Start the worker
main().catch(error => {
  console.error('‼️ Unhandled error in queue worker:', error);
  logCrash(error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});