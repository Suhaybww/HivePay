// queueRunner.ts
import 'tsconfig-paths/register'; // if you use path aliases
import { setupQueues } from './src/lib/queue/setup';

console.log('Starting queue runner...');
setupQueues(); // initializes all queues & repeated jobs

// Keep process alive
setInterval(() => {
  // Just to keep Node from exiting. Or do nothing if Bull's repeating jobs keep it alive anyway
}, 60 * 60 * 1000);
