import { contributionQueue } from './contributionQueue'; 
import { paymentQueue } from './paymentQueue';
import { processContributionCycle, retryFailedPayment, handleGroupPause } from './processors';
import { groupStatusQueue } from './groupStatusQueue';

export function setupQueues() {
  // The "contribution" queue that handles "start-contribution" tasks
  contributionQueue.process('start-contribution', processContributionCycle);

  // The separate "paymentQueue" or we can just use the same queue
  paymentQueue.process('retry-failed-payment', retryFailedPayment);

  groupStatusQueue.process('handle-group-pause', handleGroupPause);

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

    // Event listeners for new queue
    groupStatusQueue.on('completed', (job) => {
      console.log(`Group pause handled for ${job.data.groupId}`);
    });
  
    groupStatusQueue.on('failed', (job, err) => {
      console.error(`Failed to handle group pause for ${job.data.groupId}:`, err);
    });

     // Add error listeners for queue connections
  [contributionQueue, paymentQueue, groupStatusQueue].forEach(queue => {
    queue.on('error', (error) => {
      console.error(`Queue ${queue.name} error:`, error);
    });
  });

  console.log('All queues set up. Ready to process...');
}
