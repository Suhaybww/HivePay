// queueMonitor.js
require('dotenv').config();
const express = require('express');
const Bull = require('bull');
const Redis = require('ioredis');
const EventEmitter = require('events');

// Properly initialize EventEmitter
const redisEvents = new EventEmitter();
const clientCache = new Map();

function createRedisClient(role, config = {}) {
  const cacheKey = `${role}-${JSON.stringify(config)}`;
  
  // Check if we already have a client for this role and config
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }
  
  // Basic Redis options with safety settings
  const baseRedisOptions = {
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    showFriendlyErrorStack: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 10000);
      console.log(`Redis reconnection attempt ${times}. Next attempt in ${delay}ms`);
      return delay;
    },
    enableAutoPipelining: true,
    connectTimeout: 20000,
    enableOfflineQueue: true,
    lazyConnect: false
  };
  
  // Create a new client with merged options
  const client = new Redis(process.env.REDIS_URL, {
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
    clientCache.delete(cacheKey);
  });
  
  // Store in cache
  clientCache.set(cacheKey, client);
  
  return client;
}

// Create express app
const app = express();
const port = process.env.MONITOR_PORT || 3001;

// Redis connection options from config
const redis = createRedisClient('monitor');

// Queues to monitor with essential prefix
const contributionQueue = new Bull('contribution-cycles', {
  createClient: type => {
    switch (type) {
      case 'client': return createRedisClient('contribution-client');
      case 'subscriber': return createRedisClient('contribution-subscriber');
      case 'bclient': return createRedisClient('contribution-bclient');
      default: return createRedisClient(`contribution-${type}`);
    }
  },
  prefix: '{hivepay}' // CRITICAL: Must match the prefix in your worker
});

const paymentQueue = new Bull('payment-queue', {
  createClient: type => {
    switch (type) {
      case 'client': return createRedisClient('payment-client');
      case 'subscriber': return createRedisClient('payment-subscriber');
      case 'bclient': return createRedisClient('payment-bclient');
      default: return createRedisClient(`payment-${type}`);
    }
  },
  prefix: '{hivepay}' // CRITICAL: Must match the prefix in your worker
});

const groupStatusQueue = new Bull('group-status', {
  createClient: type => {
    switch (type) {
      case 'client': return createRedisClient('status-client');
      case 'subscriber': return createRedisClient('status-subscriber');
      case 'bclient': return createRedisClient('status-bclient');
      default: return createRedisClient(`status-${type}`);
    }
  },
  prefix: '{hivepay}' // CRITICAL: Must match the prefix in your worker
});

// Enable JSON middleware
app.use(express.json());

// Debug helper to list Redis keys
app.get('/api/debug/redis-keys', async (req, res) => {
  try {
    const keys = await redis.keys('{hivepay}:*');
    res.json({ keys });
  } catch (error) {
    console.error('Failed to fetch Redis keys:', error);
    res.status(500).json({ error: error.message });
  }
});

// Root dashboard route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>HivePay Queue Monitor</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          :root { --bs-body-bg: #f8f9fa; }
          .queue-card { transition: transform 0.2s; }
          .queue-card:hover { transform: translateY(-5px); }
          .bg-purple { background: #6f42c1; }
          .bg-pink { background: #d63384; }
          .chart-container { height: 300px; }
          .debug-section { 
            background: #f8f9fa;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body class="bg-light">
        <nav class="navbar navbar-dark bg-dark mb-4">
          <div class="container">
            <span class="navbar-brand">HivePay Queue Monitor</span>
            <div>
              <button class="btn btn-sm btn-outline-light ms-2" onclick="addTestJob()">Add Test Job</button>
              <button class="btn btn-sm btn-outline-danger ms-2" onclick="resetQueues()">Reset Queues</button>
            </div>
          </div>
        </nav>

        <div class="container">
          <div class="debug-section">
            <h5>Debug Info</h5>
            <div class="row mb-2">
              <div class="col-md-8">
                <p class="mb-0" id="debugInfo">Monitoring queues with prefix: {hivepay}</p>
              </div>
              <div class="col-md-4 text-end">
                <button class="btn btn-sm btn-secondary" onclick="loadDebugInfo()">Refresh Debug Info</button>
              </div>
            </div>
          </div>

          <div class="row mb-4" id="queueStats">
            <!-- Dynamic stats will be loaded here -->
          </div>

          <div class="card mb-4">
            <div class="card-body">
              <h5 class="card-title">Queue Actions</h5>
              
              <div class="row g-3">
                <div class="col-md-4">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-subtitle mb-2 text-muted">Get Jobs</h6>
                      <form id="jobsForm" onsubmit="event.preventDefault(); fetchJobs()">
                        <div class="mb-3">
                          <select class="form-select" id="jobsQueue" required>
                            <option value="">Select Queue</option>
                            <option value="contribution">Contribution</option>
                            <option value="payment">Payment</option>
                            <option value="groupStatus">Group Status</option>
                          </select>
                        </div>
                        <div class="mb-3">
                          <select class="form-select" id="jobsState" required>
                            <option value="">Select State</option>
                            <option value="waiting">Waiting</option>
                            <option value="active">Active</option>
                            <option value="failed">Failed</option>
                            <option value="completed">Completed</option>
                            <option value="delayed">Delayed</option>
                          </select>
                        </div>
                        <button type="submit" class="btn btn-primary w-100">Get Jobs</button>
                      </form>
                    </div>
                  </div>
                </div>

                <div class="col-md-4">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-subtitle mb-2 text-muted">Clean Jobs</h6>
                      <form id="cleanForm" onsubmit="event.preventDefault(); cleanJobs()">
                        <div class="mb-3">
                          <select class="form-select" id="cleanQueue" required>
                            <option value="">Select Queue</option>
                            <option value="contribution">Contribution</option>
                            <option value="payment">Payment</option>
                            <option value="groupStatus">Group Status</option>
                          </select>
                        </div>
                        <div class="mb-3">
                          <select class="form-select" id="cleanState" required>
                            <option value="">Select State</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </div>
                        <button type="submit" class="btn btn-warning w-100">Clean Jobs</button>
                      </form>
                    </div>
                  </div>
                </div>

                <div class="col-md-4">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="card-subtitle mb-2 text-muted">Retry Job</h6>
                      <form id="retryForm" onsubmit="event.preventDefault(); retryJob()">
                        <div class="mb-3">
                          <select class="form-select" id="retryQueue" required>
                            <option value="">Select Queue</option>
                            <option value="contribution">Contribution</option>
                            <option value="payment">Payment</option>
                            <option value="groupStatus">Group Status</option>
                          </select>
                        </div>
                        <div class="mb-3">
                          <input type="text" class="form-control" id="jobId" 
                                 placeholder="Job ID" required>
                        </div>
                        <button type="submit" class="btn btn-success w-100">Retry Job</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="alert-container position-fixed bottom-0 end-0 p-3"></div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
        <script>
          // Load debug info
          async function loadDebugInfo() {
            try {
              const res = await fetch('/api/debug/redis-keys');
              const data = await res.json();
              
              document.getElementById('debugInfo').innerHTML = \`
                Monitoring queues with prefix: {hivepay}<br>
                Found \${data.keys.length} Redis keys
              \`;
              
              // Also update the main stats at the same time
              loadStats();
            } catch (error) {
              showAlert('Error loading debug info: ' + error.message, 'danger');
            }
          }
          
          // Add test job
          async function addTestJob() {
            try {
              const res = await fetch('/api/add-test-job');
              const data = await res.json();
              showAlert(\`Test job added: \${data.jobId}\`, 'success');
              
              // Reload stats after adding test job
              setTimeout(loadStats, 1000);
            } catch (error) {
              showAlert('Error adding test job: ' + error.message, 'danger');
            }
          }
          
          // Reset all queues
          async function resetQueues() {
            if (!confirm('Are you sure you want to empty all queues?')) return;
            
            try {
              const res = await fetch('/api/reset-queues');
              const data = await res.json();
              showAlert('All queues reset', 'warning');
              
              // Reload stats after resetting
              setTimeout(loadStats, 1000);
            } catch (error) {
              showAlert('Error resetting queues: ' + error.message, 'danger');
            }
          }

          // Load initial queue stats
          async function loadStats() {
            try {
              const res = await fetch('/api/queue-counts');
              const data = await res.json();
              
              const statsHtml = \`
                <div class="col-md-4 mb-3">
                  <div class="card queue-card bg-purple text-white">
                    <div class="card-body">
                      <h5>Contribution Queue</h5>
                      <div>Waiting: \${data.contributionQueue.waiting}</div>
                      <div>Active: \${data.contributionQueue.active}</div>
                      <div>Delayed: \${data.contributionQueue.delayed}</div>
                      <div>Completed: \${data.contributionQueue.completed}</div>
                      <div>Failed: \${data.contributionQueue.failed}</div>
                    </div>
                  </div>
                </div>
                <div class="col-md-4 mb-3">
                  <div class="card queue-card bg-pink text-white">
                    <div class="card-body">
                      <h5>Payment Queue</h5>
                      <div>Waiting: \${data.paymentQueue.waiting}</div>
                      <div>Active: \${data.paymentQueue.active}</div>
                      <div>Delayed: \${data.paymentQueue.delayed}</div>
                      <div>Completed: \${data.paymentQueue.completed}</div>
                      <div>Failed: \${data.paymentQueue.failed}</div>
                    </div>
                  </div>
                </div>
                <div class="col-md-4 mb-3">
                  <div class="card queue-card bg-primary text-white">
                    <div class="card-body">
                      <h5>Group Status Queue</h5>
                      <div>Waiting: \${data.groupStatusQueue.waiting}</div>
                      <div>Active: \${data.groupStatusQueue.active}</div>
                      <div>Delayed: \${data.groupStatusQueue.delayed}</div>
                      <div>Completed: \${data.groupStatusQueue.completed}</div>
                      <div>Failed: \${data.groupStatusQueue.failed}</div>
                    </div>
                  </div>
                </div>
              \`;
              
              document.getElementById('queueStats').innerHTML = statsHtml;
            } catch (error) {
              showAlert('Error loading queue stats: ' + error.message, 'danger');
            }
          }

          // Form handlers
          async function fetchJobs() {
            const queue = document.getElementById('jobsQueue').value;
            const state = document.getElementById('jobsState').value;
            
            try {
              const res = await fetch(\`/api/jobs/\${queue}/\${state}?limit=50\`);
              const data = await res.json();
              window.open(\`/api/jobs/\${queue}/\${state}?limit=50\`, '_blank');
            } catch (error) {
              showAlert('Error fetching jobs: ' + error.message, 'danger');
            }
          }

          async function cleanJobs() {
            const queue = document.getElementById('cleanQueue').value;
            const state = document.getElementById('cleanState').value;
            
            try {
              const res = await fetch(\`/api/clean/\${queue}/\${state}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grace: 3600000 })
              });
              
              const result = await res.json();
              showAlert(\`Cleaned \${result.cleaned} jobs from \${queue} queue\`, 'success');
              loadStats();
            } catch (error) {
              showAlert('Error cleaning jobs: ' + error.message, 'danger');
            }
          }

          async function retryJob() {
            const queue = document.getElementById('retryQueue').value;
            const jobId = document.getElementById('jobId').value;
            
            try {
              const res = await fetch(\`/api/retry-job/\${queue}/\${jobId}\`, {
                method: 'POST'
              });
              
              const result = await res.json();
              showAlert(\`Job \${jobId} retried successfully\`, 'success');
              loadStats();
            } catch (error) {
              showAlert('Error retrying job: ' + error.message, 'danger');
            }
          }

          function showAlert(message, type) {
            const alert = document.createElement('div');
            alert.className = \`alert alert-\${type} alert-dismissible fade show\`;
            alert.role = 'alert';
            alert.innerHTML = \`
              \${message}
              <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            \`;
            
            document.querySelector('.alert-container').appendChild(alert);
            setTimeout(() => alert.remove(), 5000);
          }

          // Initial load
          loadStats();
          setInterval(loadStats, 10000);
        </script>
      </body>
    </html>
  `);
});

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

// Queue counts endpoint with enhanced logging
app.get('/api/queue-counts', async (req, res) => {
  try {
    console.log('Fetching queue counts...');
    
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
    
    // Log queue counts for debugging
    console.log('Queue counts retrieved:', {
      contribution: {
        waiting: contributionWaiting,
        active: contributionActive,
        delayed: contributionDelayed,
        completed: contributionCompleted,
        failed: contributionFailed
      },
      payment: {
        waiting: paymentWaiting,
        active: paymentActive,
        delayed: paymentDelayed,
        completed: paymentCompleted,
        failed: paymentFailed
      },
      groupStatus: {
        waiting: groupStatusWaiting,
        active: groupStatusActive,
        delayed: groupStatusDelayed,
        completed: groupStatusCompleted,
        failed: groupStatusFailed
      }
    });
    
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
    res.status(500).json({ error: 'Failed to get queue counts', details: error.message });
  }
});

// Debug endpoint for raw job counts
app.get('/api/debug-counts', async (req, res) => {
  try {
    const rawContribution = await contributionQueue.getJobCounts();
    const rawPayment = await paymentQueue.getJobCounts();
    const rawGroupStatus = await groupStatusQueue.getJobCounts();
    
    res.json({
      contributionQueue: rawContribution,
      paymentQueue: rawPayment,
      groupStatusQueue: rawGroupStatus
    });
  } catch (error) {
    console.error('Failed to get debug counts:', error);
    res.status(500).json({ error: 'Failed to get debug counts', details: error.message });
  }
});

// Add test job endpoint
app.get('/api/add-test-job', async (req, res) => {
  try {
    console.log('Adding test job to contribution queue...');
    
    // Add a test job with a unique ID
    const jobId = `test-${Date.now()}`;
    const job = await contributionQueue.add(
      'start-contribution',
      { 
        groupId: jobId,
        test: true,
        timestamp: new Date().toISOString()
      },
      {
        jobId,
        attempts: 3,
        removeOnComplete: false
      }
    );
    
    console.log(`Test job added: ${job.id}`);
    
    res.json({ 
      success: true, 
      message: 'Test job added to contribution queue', 
      jobId: job.id 
    });
  } catch (error) {
    console.error('Failed to add test job:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Reset/empty all queues
app.get('/api/reset-queues', async (req, res) => {
  try {
    console.log('Emptying all queues...');
    
    await Promise.all([
      contributionQueue.empty(),
      paymentQueue.empty(),
      groupStatusQueue.empty()
    ]);
    
    console.log('All queues emptied successfully');
    
    res.json({ 
      success: true, 
      message: 'All queues emptied successfully'
    });
  } catch (error) {
    console.error('Failed to empty queues:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get jobs by state
app.get('/api/jobs/:queue/:state', async (req, res) => {
  const { queue, state } = req.params;
  const { limit = 10 } = req.query;
  
  console.log(`Fetching ${limit} ${state} jobs from ${queue} queue...`);
  
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
    console.log(`Found ${jobs.length} ${state} jobs in ${queue} queue`);
    
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
  
  console.log(`Cleaning ${state} jobs from ${queue} queue with grace period ${grace}ms...`);
  
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
    console.log(`Cleaned ${count} ${state} jobs from ${queue} queue`);
    
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
  
  console.log(`Attempting to retry job ${id} in ${queue} queue...`);
  
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
      console.log(`Job ${id} not found in ${queue} queue`);
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Retry the job
    await job.retry();
    console.log(`Job ${id} in ${queue} queue retried successfully`);
    
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
  console.log(`Monitor configured with prefix: {hivepay}`);
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