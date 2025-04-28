// src/lib/services/recoveryService.ts
import { db } from "@/src/db";
import { GroupStatus, MembershipStatus, CycleStatus } from "@prisma/client";
import { contributionQueue } from "../queue/contributionQueue";
import { paymentQueue } from "../queue/paymentQueue";
import { groupStatusQueue } from "../queue/groupStatusQueue";
import { defaultJobOptions } from "../queue/config";
import Bull from 'bull';
import { SchedulerService } from "./schedulerService";

/**
 * Recovery service responsible for rebuilding queue jobs from database state
 * when the application restarts or if Redis data is lost.
 */
export class RecoveryService {
  
  /**
   * Main recovery function that rebuilds all necessary jobs from database state
   * This should be called on application startup
   */
  static async recoverAllJobs(): Promise<{
    recovered: number,
    details: {
      cycles: number,
      payments: number,
      groupStatus: number
    }
  }> {
    console.log('🔄 Starting queue job recovery from database state...');
    try {
      // Run recoveries in parallel for improved startup time
      const [cycleJobs, paymentJobs, groupStatusJobs] = await Promise.all([
        this.recoverCycleJobs(),
        this.recoverFailedPaymentJobs(),
        this.recoverGroupStatusJobs()
      ]);
      
      const totalRecovered = cycleJobs + paymentJobs + groupStatusJobs;
      
      console.log(`✅ Queue recovery complete: ${totalRecovered} total jobs recovered`);
      return {
        recovered: totalRecovered,
        details: {
          cycles: cycleJobs,
          payments: paymentJobs,
          groupStatus: groupStatusJobs
        }
      };
    } catch (error) {
      console.error('❌ Error recovering queue jobs:', error);
      // Don't throw - we want startup to continue even if recovery fails
      return {
        recovered: 0,
        details: {
          cycles: 0,
          payments: 0,
          groupStatus: 0
        }
      };
    }
  }
  
  /**
   * Recovers contribution cycle jobs for active groups with upcoming/past due cycles
   */
  static async recoverCycleJobs(): Promise<number> {
    console.log('🔄 Recovering contribution cycle jobs...');
    
    try {
      // Find active groups with pending cycle dates
      const groups = await db.group.findMany({
        where: {
          status: GroupStatus.Active,
          cyclesCompleted: false,
          nextCycleDate: { not: null }
        },
        select: {
          id: true,
          name: true,
          nextCycleDate: true,
          cycleStarted: true,
          totalGroupCyclesCompleted: true,
          currentMemberCycleNumber: true,
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            select: { id: true, hasBeenPaid: true }
          }
        }
      });
      
      console.log(`Found ${groups.length} active groups with pending cycles for recovery`);
      
      // Clear any existing jobs in the queue to prevent duplication
      await this.clearExistingCycleJobs(groups.map(g => g.id));
      
      let recoveredCount = 0;
      const now = new Date();
      
      // Loop through groups and create jobs
      for (const group of groups) {
        try {
          console.log(`Processing recovery for group ${group.id} (${group.name})`);
          
          // Skip groups without nextCycleDate
          if (!group.nextCycleDate) {
            console.log(`Skipping group ${group.id}: No next cycle date`);
            continue;
          }
          
          // Check if cycle is already in progress
          const inProgress = group.cycleStarted && group.groupMemberships.some(m => !m.hasBeenPaid);
          const nextCycle = new Date(group.nextCycleDate);
          
          // Calculate delay - immediate for past due or in-progress cycles
          const isPastDue = nextCycle <= now;
          const delay = isPastDue || inProgress ? 10000 : Math.max(nextCycle.getTime() - now.getTime(), 5000);
          
          console.log(`Group ${group.id}: `, {
            cycleDate: group.nextCycleDate,
            inProgress,
            isPastDue,
            delay: `${Math.round(delay / 1000)}s`,
            status: inProgress ? 'CYCLE_IN_PROGRESS' : isPastDue ? 'PAST_DUE' : 'SCHEDULED'
          });

          // Create job with appropriate priority and delay
          const jobId = `recovery-${group.id}-${Date.now()}`;
          await contributionQueue.add(
            "start-contribution",
            { 
              groupId: group.id, 
              timestamp: new Date().toISOString(),
              recovery: true,
              status: inProgress ? 'CYCLE_IN_PROGRESS' : isPastDue ? 'PAST_DUE' : 'SCHEDULED'
            },
            { 
              ...defaultJobOptions,
              jobId,
              delay,
              priority: inProgress || isPastDue ? 1 : 10 // Higher priority for past due
            }
          );
          
          // Store a recovery marker in the database for auditing
          await db.groupRecoveryLog.create({
            data: {
              groupId: group.id,
              recoveryType: 'CYCLE_RECOVERY',
              cycleNumber: group.currentMemberCycleNumber,
              jobId,
              details: JSON.stringify({
                recoveredAt: new Date().toISOString(),
                originalNextCycleDate: group.nextCycleDate,
                cycleStarted: group.cycleStarted,
                inProgress,
                isPastDue,
                delay
              })
            }
          });
          
          recoveredCount++;
          console.log(`✅ Successfully recovered cycle job for group ${group.id}`);
        } catch (error) {
          console.error(`Failed to recover cycle job for group ${group.id}:`, error);
          // Continue with other groups even if one fails
        }
      }
      
      console.log(`✅ Recovered ${recoveredCount} contribution cycle jobs`);
      return recoveredCount;
    } catch (error) {
      console.error('❌ Error recovering contribution cycle jobs:', error);
      return 0;
    }
  }
  
  /**
   * Recovers failed payment jobs that still need to be retried
   */
  static async recoverFailedPaymentJobs(): Promise<number> {
    console.log('🔄 Recovering failed payment jobs...');
    
    try {
      // Find payments that failed and have retry counts < 3
      const failedPayments = await db.payment.findMany({
        where: {
          status: 'Failed',
          retryCount: { lt: 3 },
          group: {
            status: GroupStatus.Active
          }
        },
        include: {
          group: {
            select: { id: true, name: true }
          },
          user: {
            select: { id: true, email: true }
          }
        }
      });
      
      console.log(`Found ${failedPayments.length} failed payments eligible for retry`);
      
      // Clear existing retry jobs to prevent duplication
      await this.clearExistingPaymentRetryJobs(failedPayments.map(p => p.id));
      
      let recoveredCount = 0;
      
      // Schedule retry jobs with staggered delays
      for (const [index, payment] of failedPayments.entries()) {
        try {
          // Stagger recovery to avoid overwhelming the system
          const staggerDelay = Math.floor(index / 10) * 60000; // 1 minute delay per 10 jobs
          const delay = 60000 + staggerDelay; // At least 1 minute delay plus stagger
          
          // Create new retry job
          const jobId = `recovery-payment-${payment.id}-${Date.now()}`;
          await paymentQueue.add(
            "retry-failed-payment",
            { 
              paymentId: payment.id,
              recovery: true
            },
            { 
              ...defaultJobOptions,
              jobId,
              delay,
              priority: 5 // Medium priority
            }
          );
          
          // Log the recovery
          await db.paymentRecoveryLog.create({
            data: {
              paymentId: payment.id,
              groupId: payment.groupId,
              userId: payment.userId,
              recoveryType: 'PAYMENT_RETRY',
              jobId,
              details: JSON.stringify({
                recoveredAt: new Date().toISOString(),
                retryCount: payment.retryCount,
                delay,
                amount: payment.amount.toString()
              })
            }
          });
          
          recoveredCount++;
          console.log(`✅ Recovered retry job for payment ${payment.id} (Group: ${payment.group.name})`);
        } catch (error) {
          console.error(`Failed to recover retry job for payment ${payment.id}:`, error);
          // Continue with other payments even if one fails
        }
      }
      
      console.log(`✅ Recovered ${recoveredCount} payment retry jobs`);
      return recoveredCount;
    } catch (error) {
      console.error('❌ Error recovering payment retry jobs:', error);
      return 0;
    }
  }
  
  /**
   * Recovers group status jobs for paused groups
   */
  static async recoverGroupStatusJobs(): Promise<number> {
    console.log('🔄 Recovering group status jobs...');
    
    try {
      // Find paused groups that need status notifications
      const pausedGroups = await db.group.findMany({
        where: {
          status: GroupStatus.Paused
        },
        select: {
          id: true,
          name: true,
          pauseReason: true
        }
      });
      
      console.log(`Found ${pausedGroups.length} paused groups for recovery`);
      
      // Clear existing group status jobs to prevent duplication
      await this.clearExistingGroupStatusJobs(pausedGroups.map(g => g.id));
      
      let recoveredCount = 0;
      
      // Loop through paused groups and create status jobs
      for (const [index, group] of pausedGroups.entries()) {
        try {
          // Stagger recovery to avoid overwhelming the system
          const staggerDelay = index * 5000; // 5 seconds between each group
          
          // Create new group status job
          const jobId = `recovery-group-status-${group.id}-${Date.now()}`;
          await groupStatusQueue.add(
            'handle-group-pause',
            {
              groupId: group.id,
              reason: group.pauseReason,
              recovery: true
            },
            { 
              ...defaultJobOptions,
              jobId,
              delay: 30000 + staggerDelay, // 30 seconds delay plus stagger
              priority: 3 // High priority
            }
          );
          
          // Log the recovery
          await db.groupRecoveryLog.create({
            data: {
              groupId: group.id,
              recoveryType: 'STATUS_RECOVERY',
              jobId,
              details: JSON.stringify({
                recoveredAt: new Date().toISOString(),
                pauseReason: group.pauseReason
              })
            }
          });
          
          recoveredCount++;
          console.log(`✅ Recovered status job for paused group ${group.id} (${group.name})`);
        } catch (error) {
          console.error(`Failed to recover status job for group ${group.id}:`, error);
          // Continue with other groups even if one fails
        }
      }
      
      console.log(`✅ Recovered ${recoveredCount} group status jobs`);
      return recoveredCount;
    } catch (error) {
      console.error('❌ Error recovering group status jobs:', error);
      return 0;
    }
  }
  
  /**
   * Handles next cycle scheduling after recovery
   * This should be called after the recovery process
   */
  static async scheduleNextCyclesAfterRecovery(): Promise<number> {
    console.log('🔄 Scheduling next cycles after recovery...');
    
    try {
      // Find active groups with pending next cycle dates
      const groups = await db.group.findMany({
        where: {
          status: GroupStatus.Active,
          cyclesCompleted: false,
          nextCycleDate: { not: null }
        },
        select: {
          id: true,
          name: true,
          cycleStarted: true
        }
      });
      
      console.log(`Found ${groups.length} active groups for next cycle scheduling`);
      
      let scheduledCount = 0;
      
      // Only schedule for groups that aren't in the middle of a cycle
      const groupsToSchedule = groups.filter(g => !g.cycleStarted);
      
      // Schedule next cycles using the scheduler service
      for (const group of groupsToSchedule) {
        try {
          await SchedulerService.scheduleNextCycle(group.id);
          scheduledCount++;
          console.log(`✅ Scheduled next cycle for group ${group.id} (${group.name})`);
        } catch (error) {
          console.error(`Failed to schedule next cycle for group ${group.id}:`, error);
          // Continue with other groups even if one fails
        }
      }
      
      console.log(`✅ Scheduled next cycles for ${scheduledCount} groups after recovery`);
      return scheduledCount;
    } catch (error) {
      console.error('❌ Error scheduling next cycles after recovery:', error);
      return 0;
    }
  }
  
  /**
   * Clears existing contribution jobs for the specified groups to prevent duplication
   */
  private static async clearExistingCycleJobs(groupIds: string[]): Promise<void> {
    try {
      const jobs = await contributionQueue.getJobs(['delayed', 'waiting', 'active']);
      
      const jobsToRemove = jobs.filter(job => {
        if (job.data && typeof job.data === 'object' && 'groupId' in job.data) {
          return groupIds.includes(job.data.groupId as string);
        }
        return false;
      });
      
      if (jobsToRemove.length > 0) {
        console.log(`Removing ${jobsToRemove.length} existing contribution jobs to prevent duplicates`);
        await Promise.all(jobsToRemove.map(job => job.remove()));
      }
    } catch (error) {
      console.error('Error clearing existing contribution jobs:', error);
    }
  }
  
  /**
   * Clears existing payment retry jobs for the specified payments to prevent duplication
   */
  private static async clearExistingPaymentRetryJobs(paymentIds: string[]): Promise<void> {
    try {
      const jobs = await paymentQueue.getJobs(['delayed', 'waiting', 'active']);
      
      const jobsToRemove = jobs.filter(job => {
        if (job.data && typeof job.data === 'object' && 
            'paymentId' in job.data && 
            paymentIds.includes(job.data.paymentId as string)) {
          return true;
        }
        return false;
      });
      
      if (jobsToRemove.length > 0) {
        console.log(`Removing ${jobsToRemove.length} existing payment retry jobs to prevent duplicates`);
        await Promise.all(jobsToRemove.map(job => job.remove()));
      }
    } catch (error) {
      console.error('Error clearing existing payment retry jobs:', error);
    }
  }
  
  /**
   * Clears existing group status jobs for the specified groups to prevent duplication
   */
  private static async clearExistingGroupStatusJobs(groupIds: string[]): Promise<void> {
    try {
      const jobs = await groupStatusQueue.getJobs(['delayed', 'waiting', 'active']);
      
      const jobsToRemove = jobs.filter(job => {
        if (job.data && typeof job.data === 'object' && 
            'groupId' in job.data && 
            groupIds.includes(job.data.groupId as string)) {
          return true;
        }
        return false;
      });
      
      if (jobsToRemove.length > 0) {
        console.log(`Removing ${jobsToRemove.length} existing group status jobs to prevent duplicates`);
        await Promise.all(jobsToRemove.map(job => job.remove()));
      }
    } catch (error) {
      console.error('Error clearing existing group status jobs:', error);
    }
  }
  
  /**
   * Helper method to check for stuck jobs in all queues and reprocess them
   * This is useful to run periodically via a cron job
   */
  static async checkForStuckJobs(): Promise<{
    checked: number,
    reprocessed: number
  }> {
    console.log('🔍 Checking for stuck jobs in all queues...');
    
    try {
      // Get all jobs that might be stuck
      const [contributionJobs, paymentJobs, statusJobs] = await Promise.all([
        contributionQueue.getJobs(['active', 'delayed', 'waiting']),
        paymentQueue.getJobs(['active', 'delayed', 'waiting']),
        groupStatusQueue.getJobs(['active', 'delayed', 'waiting'])
      ]);
      
      // Count the total jobs
      const totalJobs = contributionJobs.length + paymentJobs.length + statusJobs.length;
      console.log(`Found ${totalJobs} total jobs across all queues`);
      
      // Look for potentially stuck jobs (active for more than 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const potentiallyStuckJobs = [
        ...contributionJobs,
        ...paymentJobs,
        ...statusJobs
      ].filter(job => 
        job.processedOn && job.processedOn < fiveMinutesAgo && !job.finishedOn
      );
      
      console.log(`Found ${potentiallyStuckJobs.length} potentially stuck jobs`);
      
      // Attempt to reprocess stuck jobs
      let reprocessedCount = 0;
      for (const job of potentiallyStuckJobs) {
        try {
          console.log(`Attempting to reprocess stuck job ${job.id} (queue: ${job.queue.name})`);
          
          // Force job to be marked as stalled so Bull will retry it
          await job.moveToFailed({ message: 'Marked as stalled by recovery process' }, true);
          await job.retry();
          
          reprocessedCount++;
          console.log(`Successfully reprocessed stuck job ${job.id}`);
        } catch (error) {
          console.error(`Failed to reprocess stuck job ${job.id}:`, error);
        }
      }
      
      console.log(`✅ Recovery check complete: ${reprocessedCount}/${potentiallyStuckJobs.length} stuck jobs reprocessed`);
      return {
        checked: totalJobs,
        reprocessed: reprocessedCount
      };
    } catch (error) {
      console.error('❌ Error checking for stuck jobs:', error);
      return {
        checked: 0,
        reprocessed: 0
      };
    }
  }
}