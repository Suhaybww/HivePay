// Add at the VERY TOP
import 'dotenv/config'; // Explicit environment loading
import path from 'path';

// Verify environment is loaded
console.log('Stripe Key:', process.env.STRIPE_SECRET_KEY?.slice(0,8));

// Configure paths if using path aliases
require('tsconfig-paths').register({
  baseUrl: __dirname,
  paths: {
    '@/src/*': ['./src/*'],
    '@/lib/*': ['./src/lib/*']
  }
});

// Initialize queues
import { setupQueues } from '@/src/lib/queue/setup';
console.log('Starting queue runner...');
setupQueues();