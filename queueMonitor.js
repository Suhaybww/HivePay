// queueMonitor.js
require('dotenv').config();
const express = require('express');
const Bull = require('bull');
const { createRedisClient } = require('./src/lib/redis/redisClient');

// Create express app
const app = express();
const port = process.env.MONITOR_PORT || 3001;

// Redis connection options from config
const redis = createRedisClient('monitor');

// Queues to monitor
const contributionQueue = new Bull('contribution-cycles', {
  createClient: type => {
    switch (type) {
      case 'client': return createRedisClient('contribution-client');
      case 'subscriber': return createRedisClient('contribution-subscriber');
      case 'bclient': return createRedisClient('contribution-bclient');
      default: return createRedisClient(`contribution-${type}`);
    }
  }
});

const paymentQueue = new Bull('payment-queue', {
  createClient: type => {
    switch (type) {
      case 'client': return createRedisClient('payment-client');
      case 'subscriber': return createRedisClient('payment-subscriber');
      case 'bclient': return createRedisClient('payment-bclient');
      default: return createRedisClient(`payment-${type}`);
    }
  }
});

const groupStatusQueue = new Bull('group-status', {
  createClient: type => {
    switch (type) {
      case 'client': return createRedisClient('status-client');
      case 'subscriber': return createRedisClient('status-subscriber');
      case 'bclient': return createRedisClient('status-bclient');
      default: return createRedisClient(`status-${type}`);
    }
  }
});

// Enable JSON middleware
app.use(express.json());

// Simple health check endpoint
app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Queue counts endpoint
app.get('/api/queue-counts', async (req, res) => {
  try {
    const [
      contributionWaiting, contributionActive, contributionDelayed, contributionCompleted, contributionFailed,
      paymentWaiting, paymentActive, paymentDelayed, paymentCompleted, paymentFailed,
      groupStatusWaiting, groupStatusActive, groupStatusDelayed, groupStatusCompleted, groupStatusFailed
    ] = await Promise.all([
      contributionQueue.getWaitingCount(),
      contributionQueue.getActiveCount(),
      contributionQueue.getDelayedCount(),
      contributionQueue.getCompletedCount(),
      contributionQueue.getFailedCount(),
      
      paymentQueue.getWaitingCount(),
      paymentQueue.getActiveCount(),
      paymentQueue.getDelayedCount(),
      paymentQueue.getCompletedCount(),
      paymentQueue.getFailedCount(),
      
      groupStatusQueue.getWaitingCount(),
      groupStatusQueue.getActiveCount(),
      groupStatusQueue.getDelayedCount(),
      groupStatusQueue.getCompletedCount(),
      groupStatusQueue.getFailedCount()
    ]);
    
    res.json({
      contributionQueue: {
        waiting: contributionWaiting,
        active: contributionActive,
        delayed: contributionDelayed,
        completed: contributionCompleted,
        failed: contributionFailed
      },
      paymentQueue: {
        waiting: paymentWaiting,
        active: paymentActive,
        delayed: paymentDelayed,
        completed: paymentCompleted,
        failed: paymentFailed
      },
      groupStatusQueue: {
        waiting: groupStatusWaiting,
        active: groupStatusActive,
        delayed: groupStatusDelayed,
        completed: groupStatusCompleted,
        failed: groupStatusFailed
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get queue counts:', error);
    res.status(500).json({ error: 'Failed to get queue counts' });
  }
});

// Get jobs by state
app.get('/api/jobs/:queue/:state', async (req, res) => {
  const { queue, state } = req.params;
  const { limit = 10 } = req.query;
  
  // Validate queue
  let targetQueue;
  switch (queue) {
    case 'contribution':
      targetQueue = contributionQueue;
      break;
    case 'payment':
      targetQueue = paymentQueue;
      break;
    case 'groupStatus':
      targetQueue = groupStatusQueue;
      break;
    default:
      return res.status(400).json({ error: 'Invalid queue name' });
  }
  
  // Validate state
  if (!['active', 'waiting', 'delayed', 'completed', 'failed'].includes(state)) {
    return res.status(400).json({ error: 'Invalid state' });
  }
  
  try {
    // Get jobs with the specified state
    const jobs = await targetQueue.getJobs([state], 0, parseInt(limit));
    
    // Format jobs for response
    const formattedJobs = jobs.map(job => ({
      id: job.id,
      data: job.data,
      name: job.name,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason
    }));
    
    res.json({
      queue,
      state,
      count: formattedJobs.length,
      jobs: formattedJobs
    });
  } catch (error) {
    console.error(`Failed to get ${state} jobs for ${queue}:`, error);
    res.status(500).json({ error: `Failed to get jobs: ${error.message}` });
  }
});

// Clean jobs
app.post('/api/clean/:queue/:state', async (req, res) => {
  const { queue, state } = req.params;
  const { grace = 3600000 } = req.body; // Default 1 hour
  
  // Validate queue
  let targetQueue;
  switch (queue) {
    case 'contribution':
      targetQueue = contributionQueue;
      break;
    case 'payment':
      targetQueue = paymentQueue;
      break;
    case 'groupStatus':
      targetQueue = groupStatusQueue;
      break;
    default:
      return res.status(400).json({ error: 'Invalid queue name' });
  }
  
  // Validate state
  if (!['completed', 'failed'].includes(state)) {
    return res.status(400).json({ error: 'Can only clean completed or failed jobs' });
  }
  
  try {
    // Clean jobs
    const count = await targetQueue.clean(parseInt(grace), state);
    
    res.json({
      queue,
      state,
      cleaned: count,
      grace
    });
  } catch (error) {
    console.error(`Failed to clean ${state} jobs for ${queue}:`, error);
    res.status(500).json({ error: `Failed to clean jobs: ${error.message}` });
  }
});

// Retry failed job
app.post('/api/retry-job/:queue/:id', async (req, res) => {
  const { queue, id } = req.params;
  
  // Validate queue
  let targetQueue;
  switch (queue) {
    case 'contribution':
      targetQueue = contributionQueue;
      break;
    case 'payment':
      targetQueue = paymentQueue;
      break;
    case 'groupStatus':
      targetQueue = groupStatusQueue;
      break;
    default:
      return res.status(400).json({ error: 'Invalid queue name' });
  }
  
  try {
    // Get the job
    const job = await targetQueue.getJob(id);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Retry the job
    await job.retry();
    
    res.json({
      queue,
      id,
      status: 'retried'
    });
  } catch (error) {
    console.error(`Failed to retry job ${id} for ${queue}:`, error);
    res.status(500).json({ error: `Failed to retry job: ${error.message}` });
  }
});

// Prometheus metrics endpoint (simplified)
app.get('/metrics', async (req, res) => {
  try {
    const [
      // Contribution queue metrics
      contributionWaiting, contributionActive, contributionDelayed, contributionCompleted, contributionFailed,
      // Payment queue metrics
      paymentWaiting, paymentActive, paymentDelayed, paymentCompleted, paymentFailed,
      // Group status queue metrics
      groupStatusWaiting, groupStatusActive, groupStatusDelayed, groupStatusCompleted, groupStatusFailed
    ] = await Promise.all([
      contributionQueue.getWaitingCount(),
      contributionQueue.getActiveCount(),
      contributionQueue.getDelayedCount(),
      contributionQueue.getCompletedCount(),
      contributionQueue.getFailedCount(),
      
      paymentQueue.getWaitingCount(),
      paymentQueue.getActiveCount(),
      paymentQueue.getDelayedCount(),
      paymentQueue.getCompletedCount(),
      paymentQueue.getFailedCount(),
      
      groupStatusQueue.getWaitingCount(),
      groupStatusQueue.getActiveCount(),
      groupStatusQueue.getDelayedCount(),
      groupStatusQueue.getCompletedCount(),
      groupStatusQueue.getFailedCount()
    ]);
    
    // Format metrics in Prometheus format
    const metrics = [
      `# HELP bull_queue_jobs Jobs count by queue and status`,
      `# TYPE bull_queue_jobs gauge`,
      `bull_queue_jobs{queue="contribution",status="waiting"} ${contributionWaiting}`,
      `bull_queue_jobs{queue="contribution",status="active"} ${contributionActive}`,
      `bull_queue_jobs{queue="contribution",status="delayed"} ${contributionDelayed}`,
      `bull_queue_jobs{queue="contribution",status="completed"} ${contributionCompleted}`,
      `bull_queue_jobs{queue="contribution",status="failed"} ${contributionFailed}`,
      
      `bull_queue_jobs{queue="payment",status="waiting"} ${paymentWaiting}`,
      `bull_queue_jobs{queue="payment",status="active"} ${paymentActive}`,
      `bull_queue_jobs{queue="payment",status="delayed"} ${paymentDelayed}`,
      `bull_queue_jobs{queue="payment",status="completed"} ${paymentCompleted}`,
      `bull_queue_jobs{queue="payment",status="failed"} ${paymentFailed}`,
      
      `bull_queue_jobs{queue="groupStatus",status="waiting"} ${groupStatusWaiting}`,
      `bull_queue_jobs{queue="groupStatus",status="active"} ${groupStatusActive}`,
      `bull_queue_jobs{queue="groupStatus",status="delayed"} ${groupStatusDelayed}`,
      `bull_queue_jobs{queue="groupStatus",status="completed"} ${groupStatusCompleted}`,
      `bull_queue_jobs{queue="groupStatus",status="failed"} ${groupStatusFailed}`,
    ].join('\n');
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('Failed to generate metrics:', error);
    res.status(500).send(`# Error collecting metrics: ${error.message}`);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Queue monitor running at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await Promise.all([
    contributionQueue.close(),
    paymentQueue.close(),
    groupStatusQueue.close()
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await Promise.all([
    contributionQueue.close(),
    paymentQueue.close(),
    groupStatusQueue.close()
  ]);
  process.exit(0);
});