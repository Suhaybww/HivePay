// src/lib/queue/paymentQueue.ts
import Bull from 'bull';
import { bullOptions, defaultJobOptions } from './config';

// Module-scoped variable for singleton
let queueInstance: Bull.Queue | null = null;

// Function to get the queue instance with connection verification
function getQueue(): Bull.Queue {
  if (!queueInstance) {
    console.log('🔍 Creating new payment queue instance');
    queueInstance = new Bull('payment-queue', bullOptions);
    
    // Verify connection
    queueInstance.isReady()
      .then(() => console.log('✅ Payment queue connection verified'))
      .catch(err => console.error('❌ Payment queue connection failed:', err));
  } else {
    console.log('♻️ Reusing existing payment queue instance');
  }
  return queueInstance;
}

// Export the queue
export const paymentQueue = getQueue();
export const defaultPaymentJobOptions = {
  ...defaultJobOptions,
  removeOnFail: false
};

// Diagnostic method to verify queue connectivity
export async function verifyPaymentQueue(): Promise<boolean> {
  try {
    await paymentQueue.isReady();
    console.log('✅ Payment queue is connected and ready');
    return true;
  } catch (error) {
    console.error('❌ Payment queue connection failed:', error);
    return false;
  }
}