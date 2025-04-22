// src/lib/queue/paymentQueue.ts
import Bull from 'bull';
import { bullOptions, defaultJobOptions } from './config';

export const paymentQueue = new Bull('payment-queue', bullOptions);
export const defaultPaymentJobOptions = {
  ...defaultJobOptions,
  removeOnFail: false
};