// src/lib/queue/contributionQueue.ts
import Bull from 'bull';
import { bullOptions, defaultJobOptions } from './config';

// Module-scoped variable for singleton
let queueInstance: Bull.Queue | null = null;

// Function to get the queue instance with connection verification
function getQueue(): Bull.Queue {
  if (!queueInstance) {
    console.log('🔍 Creating new contribution queue instance');
    queueInstance = new Bull('contribution-cycles', bullOptions);
    
    // Verify connection
    queueInstance.isReady()
      .then(() => console.log('✅ Contribution queue connection verified'))
      .catch(err => console.error('❌ Contribution queue connection failed:', err));
  } else {
    console.log('♻️ Reusing existing contribution queue instance');
  }
  return queueInstance;
}

// Export the queue
export const contributionQueue = getQueue();
export const contributionJobOptions = defaultJobOptions;

// Diagnostic method to verify queue connectivity
export async function verifyContributionQueue(): Promise<boolean> {
  try {
    console.log('🔍 Testing contribution queue connectivity...');
    await contributionQueue.isReady();
    console.log('✅ Contribution queue is connected and ready');
    return true;
  } catch (error) {
    console.error('❌ Contribution queue connection failed:', error);
    return false;
  }
}