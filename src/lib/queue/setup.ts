import { contributionQueue, payoutQueue } from './config';
import { processContributionCycle, processGroupPayout } from './processors';

export function setupQueues() {
  // Process contribution cycles
  contributionQueue.process('start-contribution', processContributionCycle);

  // Process payouts
  payoutQueue.process('process-payout', processGroupPayout);

  // Error handling for queues
  contributionQueue.on('error', (error) => {
    console.error('Contribution queue error:', error);
  });

  payoutQueue.on('error', (error) => {
    console.error('Payout queue error:', error);
  });

  // Job completion handling
  contributionQueue.on('completed', (job) => {
    console.log(`Contribution cycle completed for group ${job.data.groupId}`);
  });

  payoutQueue.on('completed', (job) => {
    console.log(`Payout processed for group ${job.data.groupId}`);
  });

  console.log('Queue processors initialized');
}