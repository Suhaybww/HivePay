// src/lib/queue/setupQueues.ts
import { contributionQueue } from './contributionQueue'; // or wherever you define
import { paymentQueue } from './paymentQueue';
import { processContributionCycle, retryFailedPayment } from './processors';

export function setupQueues() {
  // The "contribution" queue that handles "start-contribution" tasks
  contributionQueue.process('start-contribution', processContributionCycle);

  // The separate "paymentQueue" or we can just use the same queue
  paymentQueue.process('retry-failed-payment', retryFailedPayment);

  // Set up events if desired
  contributionQueue.on('completed', (job) => {
    console.log(`Contribution cycle completed for group ${job.data.groupId}`);
  });
  contributionQueue.on('failed', (job, err) => {
    console.error(`Contribution cycle failed for group ${job.data.groupId}`, err);
  });

  paymentQueue.on('completed', (job) => {
    console.log(`Payment retry job completed for payment ${job.data.paymentId}`);
  });
  paymentQueue.on('failed', (job, err) => {
    console.error(`Payment retry job failed for payment ${job.data.paymentId}`, err);
  });

  console.log('All queues set up. Ready to process...');
}
