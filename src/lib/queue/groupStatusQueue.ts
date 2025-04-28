// src/lib/queue/groupStatusQueue.ts
import Bull from 'bull';
import { bullOptions, defaultJobOptions } from './config';

// Module-scoped variable for singleton
let queueInstance: Bull.Queue | null = null;

// Function to get the queue instance with connection verification
function getQueue(): Bull.Queue {
  if (!queueInstance) {
    console.log('🔍 Creating new group status queue instance');
    queueInstance = new Bull('group-status', {
      ...bullOptions,
      defaultJobOptions
    });
    
    // Verify connection
    queueInstance.isReady()
      .then(() => console.log('✅ Group status queue connection verified'))
      .catch(err => console.error('❌ Group status queue connection failed:', err));
  } else {
    console.log('♻️ Reusing existing group status queue instance');
  }
  return queueInstance;
}

// Export the queue
export const groupStatusQueue = getQueue();

// Diagnostic method to verify queue connectivity
export async function verifyGroupStatusQueue(): Promise<boolean> {
  try {
    await groupStatusQueue.isReady();
    console.log('✅ Group status queue is connected and ready');
    return true;
  } catch (error) {
    console.error('❌ Group status queue connection failed:', error);
    return false;
  }
}