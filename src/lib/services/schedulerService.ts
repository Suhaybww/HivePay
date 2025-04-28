// src/services/schedulerService.ts
import { db } from "@/src/db";
import { defaultJobOptions } from "../queue/config";
import { contributionQueue } from "../queue/contributionQueue";
import { GroupStatus, MembershipStatus, Frequency } from "@prisma/client";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { MetricsService } from "./metricsService";
import { addWeeks, addMonths } from "date-fns";

// Constants for scheduling
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const DEFAULT_GRACE_PERIOD_MS = 30000; // 30 seconds buffer

export class SchedulerService {
  private static readonly TIMEZONE = "Australia/Melbourne";
  private static readonly JOB_PREFIX = "contribution";
  
  // Tracking for scheduled groups to prevent race conditions
  private static scheduledGroups = new Set<string>();
  private static scheduledTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Enhanced scheduleContributionCycle with improved reliability
   * - Added database logging
   * - Added redundant scheduling via setTimeout for critical cycles
   * - Added metrics tracking
   * - Improved error handling and retries
   */
  static async scheduleContributionCycle(
    groupId: string, 
    options: { 
      retryAttempt?: number,
      forceLock?: boolean, 
      backupOnly?: boolean 
    } = {}
  ): Promise<void> {
    const retryAttempt = options.retryAttempt || 0;
    const startTime = Date.now();
    
    try {
      console.log(`🔍 DEBUG: scheduleContributionCycle called for group ${groupId} (attempt: ${retryAttempt})`);
      console.log(`🔥 CRITICAL PATH: Scheduling contribution cycle for group ${groupId}`);
      
      // Prevent duplicate scheduling unless forced
      if (this.scheduledGroups.has(groupId) && !options.forceLock) {
        console.log(`🔄 Group ${groupId} already has a scheduled job, skipping`);
        return;
      }

      console.log(`🔄 Starting schedule process for group ${groupId}`);
      
      // Get group details with necessary selects
      const group = await db.group.findUnique({
        where: { id: groupId },
        select: { 
          id: true,
          name: true,
          nextCycleDate: true, 
          status: true,
          cycleStarted: true,
          cyclesCompleted: true,
          futureCyclesJson: true,
          contributionAmount: true,
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            select: { hasBeenPaid: true }
          }
        },
      });

      console.log(`🔍 DEBUG: Group state from database:`, {
        groupId,
        nextCycleDate: group?.nextCycleDate,
        status: group?.status,
        cycleStarted: group?.cycleStarted,
        cyclesCompleted: group?.cyclesCompleted,
        name: group?.name,
        membersPaid: group?.groupMemberships.filter(m => m.hasBeenPaid).length,
        totalMembers: group?.groupMemberships.length
      });

      if (!group) {
        console.error(`❌ Group ${groupId} not found`);
        return;
      }

      if (group.status !== GroupStatus.Active) {
        console.log(`⏸️  Group ${groupId} is not active (status: ${group.status})`);
        return;
      }

      if (group.cyclesCompleted) {
        console.log(`⏸️  Group ${groupId} cycles already completed, skipping scheduling`);
        return;
      }

      // Mark this group as scheduled with a lock
      this.scheduledGroups.add(groupId);
      console.log(`🔍 DEBUG: Added group ${groupId} to scheduledGroups set (size: ${this.scheduledGroups.size})`);

      // Create a job ID that includes retry attempt for traceability
      const jobId = `${this.JOB_PREFIX}-${groupId}-${Date.now()}-${retryAttempt}`;
      const jobDetails = {
        groupId,
        options: {
          ...defaultJobOptions,
          jobId
        }
      };

      console.log(`🔍 DEBUG: Calculating next run for group ${groupId} with nextCycleDate:`, group.nextCycleDate);
      const { nextRun, delay } = await this.calculateAndSetNextRun(groupId, group.nextCycleDate, group.cycleStarted);
      
      jobDetails.options.delay = delay;

      // Log detailed scheduling information
      console.log(`⏰ Scheduling next run for group ${groupId}:`, {
        groupName: group.name,
        scheduledTime: formatInTimeZone(nextRun, this.TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz"),
        delayMs: delay,
        jobId: jobDetails.options.jobId,
        contributionAmount: group.contributionAmount?.toString() || 'unknown',
        unpaidMembers: group.groupMemberships.filter(m => !m.hasBeenPaid).length
      });

      // Set a timeout to remove group from scheduled set - automatic cleanup
      const cleanupTimeout = setTimeout(() => {
        this.scheduledGroups.delete(groupId);
        console.log(`🔄 Removed group ${groupId} from scheduled set after timeout`);
      }, delay + 10000); // Add 10 seconds buffer
      
      // Store the timeout for cleanup during shutdown
      this.scheduledTimers.set(groupId, cleanupTimeout);

      // Log the scheduled job in the database for recovery purposes
      await this.logScheduledJob(groupId, jobId, nextRun, delay);

      // Only skip Bull queue if backupOnly is true
      if (!options.backupOnly) {
        await this.addQueueJob(jobDetails);
      }
      
      // For critical jobs (short delay), set up a redundant setTimeout as backup
      // This ensures the job runs even if Redis fails temporarily
      if (delay < 5 * 60 * 1000) { // Less than 5 minutes
        this.scheduleBackupTimer(groupId, jobId, delay);
      }
      
      // Record metrics for successful scheduling
      MetricsService.recordQueueEvent('scheduler', 'job_scheduled');
      
      // Calculate elapsed time and record it
      const elapsed = Date.now() - startTime;
      MetricsService.recordJobProcessingTime('scheduler', 'scheduleContributionCycle', elapsed);
      
    } catch (error) {
      // Remove group from scheduledGroups in case of error to allow retries
      this.scheduledGroups.delete(groupId);
      
      console.error(`‼️ Failed to schedule group ${groupId}:`, error);
      
      // Record the error
      MetricsService.recordJobFailure(
        'scheduler', 
        'scheduleContributionCycle', 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Retry logic for transient failures
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        const nextRetryDelay = RETRY_DELAY_MS * Math.pow(2, retryAttempt);
        console.log(`🔄 Retrying in ${nextRetryDelay}ms (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        setTimeout(() => {
          this.scheduleContributionCycle(groupId, { 
            retryAttempt: retryAttempt + 1,
            forceLock: true
          });
        }, nextRetryDelay);
      } else {
        // If we've exhausted retries, schedule a backup timer as last resort
        console.log(`⚠️ Scheduling backup timer after exhausting retries for group ${groupId}`);
        this.scheduleBackupTimer(groupId, `backup-${groupId}-${Date.now()}`, 60000);
        
        // After max retries, rethrow for higher-level handling
        throw error;
      }
    }
  }

  /**
   * Enhanced scheduleNextCycle with cycle validation, date advancement,
   * and improved error handling
   */
  static async scheduleNextCycle(groupId: string, options: { 
    retryAttempt?: number,
    forceLock?: boolean
  } = {}): Promise<void> {
    const retryAttempt = options.retryAttempt || 0;
    const startTime = Date.now();
    
    try {
      console.log(`🔍 DEBUG: scheduleNextCycle called for group ${groupId} (attempt: ${retryAttempt})`);

      // Prevent duplicate scheduling unless forced
      if (this.scheduledGroups.has(groupId) && !options.forceLock) {
        console.log(`🔄 Group ${groupId} already has a scheduled next cycle, skipping`);
        return;
      }

      console.log(`🔁 Attempting to schedule next cycle for group ${groupId}`);
      
      // Fetch group with all necessary data
      const group = await db.group.findUnique({
        where: { id: groupId },
        select: { 
          id: true,
          name: true,
          status: true,
          nextCycleDate: true,
          cycleStarted: true,
          cyclesCompleted: true,
          futureCyclesJson: true,
          totalGroupCyclesCompleted: true,
          contributionAmount: true,
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            select: { hasBeenPaid: true }
          }
        },
      });

      console.log(`🔍 DEBUG: Group state in scheduleNextCycle:`, {
        groupId,
        status: group?.status,
        nextCycleDate: group?.nextCycleDate,
        cycleStarted: group?.cycleStarted,
        cyclesCompleted: group?.cyclesCompleted,
        totalCycles: group?.totalGroupCyclesCompleted,
        name: group?.name,
        memberCount: group?.groupMemberships.length
      });

      if (!group) {
        console.error(`❌ Group ${groupId} not found during next cycle scheduling`);
        return;
      }

      if (group.status !== GroupStatus.Active) {
        console.log(`⏸️  Skipping inactive group: ${groupId} (status: ${group.status})`);
        return;
      }

      // Check if all cycles are completed
      if (group.cyclesCompleted) {
        console.log(`⏹️  Group ${groupId} cycles already completed, skipping scheduling`);
        return;
      }

      // FIXED: Instead of blocking on cycleStarted, check for remaining unpaid members
      if (group.cycleStarted) {
        // Count unpaid members directly to avoid another DB query
        const remainingUnpaidMembers = group.groupMemberships.filter(m => !m.hasBeenPaid).length;

        console.log(`🔍 DEBUG: Group ${groupId} has ${remainingUnpaidMembers} unpaid members remaining`);

        if (remainingUnpaidMembers === 0) {
          console.log(`✅ All members paid in group ${groupId}, cycle is complete`);
          
          // Update the group to mark the full cycle as complete
          await db.group.update({
            where: { id: groupId },
            data: { 
              cyclesCompleted: true,
              // Reset for the next full cycle when needed
              cycleStarted: false 
            }
          });
          
          console.log(`🔄 Updated group ${groupId} state: cyclesCompleted=true, cycleStarted=false`);
          return;
        } else {
          console.log(`🔄 Group ${groupId} cycle in progress with ${remainingUnpaidMembers} unpaid members remaining`);
          // Continue with the current cycle
        }
      }

      console.log(`✅ Validations passed, proceeding to schedule group ${groupId}`);
      
      // Now call scheduleContributionCycle to handle the actual scheduling
      await this.scheduleContributionCycle(groupId, { 
        retryAttempt, 
        forceLock: options.forceLock 
      });
      
      // Record metrics for successful next cycle scheduling
      MetricsService.recordQueueEvent('scheduler', 'next_cycle_scheduled');
      
      // Calculate elapsed time and record it
      const elapsed = Date.now() - startTime;
      MetricsService.recordJobProcessingTime('scheduler', 'scheduleNextCycle', elapsed);
      
    } catch (error) {
      console.error(`‼️ Next cycle scheduling failed for group ${groupId}:`, error);
      
      // Record the error
      MetricsService.recordJobFailure(
        'scheduler', 
        'scheduleNextCycle', 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Retry logic for transient failures
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        const nextRetryDelay = RETRY_DELAY_MS * Math.pow(2, retryAttempt);
        console.log(`🔄 Retrying in ${nextRetryDelay}ms (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        setTimeout(() => {
          this.scheduleNextCycle(groupId, { 
            retryAttempt: retryAttempt + 1,
            forceLock: true
          });
        }, nextRetryDelay);
      } else {
        // After max retries, rethrow for higher-level handling
        throw error;
      }
    }
  }

  /**
   * Calculate the next run time for a contribution cycle
   */
  private static async calculateAndSetNextRun(
    groupId: string,
    currentDate: Date | null,
    cycleStarted: boolean = false
  ): Promise<{ nextRun: Date; delay: number }> {
    console.log(`🔍 DEBUG: calculateAndSetNextRun for group ${groupId} with currentDate:`, currentDate);
    console.log(`🔍 DEBUG: Cycle already started: ${cycleStarted}`);
    
    const now = new Date();
    let nextRun = currentDate ? new Date(currentDate) : new Date();
    
    console.log(`🔍 DEBUG: Initial nextRun:`, nextRun);
    console.log(`🔍 DEBUG: Current time:`, now);
    console.log(`🔍 DEBUG: Is nextRun in the past?`, nextRun <= now);
    
    if (nextRun <= now) {
      // Add a small buffer (30 seconds) to ensure we're in the future
      nextRun = new Date(now.getTime() + DEFAULT_GRACE_PERIOD_MS);
      console.log(`⏩ Setting immediate execution with buffer: ${nextRun.toISOString()}`);
    }
    
    // Important: In a ROSCA, if cycle has started and there are still members to be paid,
    // we should NOT update the nextCycleDate in the database, as this would shift the cycle
    // for future members. We only schedule the immediate execution time.
    
    const delay = nextRun.getTime() - Date.now();
    
    // Ensure delay is never negative and has a minimum value
    const safeDelay = Math.max(delay, DEFAULT_GRACE_PERIOD_MS); // Minimum 30 seconds
    
    console.log(`🔍 DEBUG: Final nextRun:`, nextRun);
    console.log(`🔍 DEBUG: Initial delay:`, delay);
    console.log(`🔍 DEBUG: Safe delay:`, safeDelay);
    
    return { nextRun, delay: safeDelay };
  }

  /**
   * Add a job to the Bull queue with enhanced error handling
   */
  private static async addQueueJob(jobDetails: {
    groupId: string;
    options: typeof defaultJobOptions & { jobId: string; delay?: number };
  }): Promise<void> {
    try {
      console.log(`🔍 DEBUG: addQueueJob called for group ${jobDetails.groupId} with options:`, jobDetails.options);
      console.log(`🔥 CRITICAL PATH: Queue job attempt for group ${jobDetails.groupId}`);
      console.log(`🔍 Redis URL in use: ${process.env.REDIS_URL?.replace(/(redis:\/\/|rediss:\/\/)(.*?)@/g, '$1****@')}`);
      
      // Check if queue is ready
      try {
        const isReady = await contributionQueue.isReady();
        console.log(`🔍 DEBUG: Contribution queue ready check: ${isReady}`);
      } catch (readyError) {
        console.error(`❌ CRITICAL: Queue ready check FAILED with error:`, readyError);
        // Try to recover by forcing a ping to diagnose connection
        try {
          if (contributionQueue.client) {
            await contributionQueue.client.ping();
            console.log(`✅ Forced Redis ping succeeded despite ready check failure`);
          }
        } catch (pingError) {
          console.error(`❌ Forced Redis ping also failed:`, pingError);
          // Use backup scheduling method
          this.scheduleBackupTimer(
            jobDetails.groupId, 
            jobDetails.options.jobId, 
            jobDetails.options.delay || DEFAULT_GRACE_PERIOD_MS
          );
          throw pingError;
        }
      }
      
      // Clear any existing jobs for this group before adding a new one
      console.log(`🔍 DEBUG: Getting existing jobs for group ${jobDetails.groupId}`);
      let existingJobs: any[] = [];
      try {
        existingJobs = await contributionQueue.getJobs(['delayed', 'waiting']);
        console.log(`🔍 DEBUG: Found ${existingJobs.length} existing jobs in queue`);
      } catch (getJobsError) {
        console.error(`‼️ Failed to get existing jobs:`, getJobsError);
      }

      for (const job of existingJobs) {
        if (job.data && job.data.groupId === jobDetails.groupId) {
          console.log(`⚠️ Removing existing job for group ${jobDetails.groupId}: ${job.id}`);
          try {
            await job.remove();
            console.log(`✅ Successfully removed job ${job.id}`);
          } catch (removeError) {
            console.error(`‼️ Failed to remove job ${job.id}:`, removeError);
          }
        }
      }

      console.log(`🚀 QUEUING: Adding job for group ${jobDetails.groupId} with options:`, {
        jobId: jobDetails.options.jobId,
        delay: jobDetails.options.delay, 
        attempts: jobDetails.options.attempts
      });
      
      // Direct debugging of queue instance
      console.log(`Queue instance details:`, {
        name: contributionQueue.name,
        hasClient: !!contributionQueue.client,
        clientType: contributionQueue.client ? typeof contributionQueue.client : 'none'
      });
      
      const job = await contributionQueue.add(
        "start-contribution",
        { 
          groupId: jobDetails.groupId,
          timestamp: new Date().toISOString() 
        },
        jobDetails.options
      );

      console.log(`✅ Successfully queued job:`, {
        jobId: job.id,
        groupId: jobDetails.groupId,
        timestamp: new Date().toISOString(),
        delay: jobDetails.options.delay,
        willRunAt: new Date(Date.now() + (jobDetails.options.delay || 0)).toISOString()
      });

      // Verify the job was added by checking the queue
      console.log(`🔍 DEBUG: Verifying job was added to queue`);
      try {
        const queueJobs = await contributionQueue.getJobs(['delayed', 'waiting']);
        console.log(`📊 Queue status after adding job: ${queueJobs.length} total jobs`);
        
        let foundJob = false;
        for (const queueJob of queueJobs) {
          if (queueJob.id === job.id) {
            console.log(`✓ Confirmed job ${job.id} is in queue with delay ${queueJob.opts.delay}ms`);
            foundJob = true;
          }
        }
        
        if (!foundJob) {
          console.warn(`⚠️ Added job ${job.id} not found in queue - this could indicate an issue`);
          
          // Try direct add as a fallback
          console.log(`🔄 Attempting fallback direct queue operation...`);
          const backupJob = await contributionQueue.add(
            "start-contribution", 
            { 
              groupId: jobDetails.groupId, 
              timestamp: new Date().toISOString(),
              fallback: true
            },
            { 
              attempts: 3, 
              jobId: `fallback-${jobDetails.groupId}-${Date.now()}`,
              delay: jobDetails.options.delay || 0
            }
          );
          console.log(`✅ Fallback job added: ${backupJob.id}`);
          
          // Additionally set up a backup timer
          this.scheduleBackupTimer(
            jobDetails.groupId, 
            `timer-fallback-${jobDetails.groupId}`, 
            jobDetails.options.delay || DEFAULT_GRACE_PERIOD_MS
          );
        }
      } catch (verifyError) {
        console.error(`‼️ Failed to verify job addition:`, verifyError);
        
        // Try direct add as a fallback
        console.log(`🔄 Attempting fallback direct queue operation...`);
        try {
          const backupJob = await contributionQueue.add(
            "start-contribution", 
            { 
              groupId: jobDetails.groupId, 
              timestamp: new Date().toISOString(),
              fallback: true
            },
            { 
              attempts: 3, 
              jobId: `fallback-${jobDetails.groupId}-${Date.now()}`,
              delay: jobDetails.options.delay || 0
            }
          );
          console.log(`✅ Fallback job added: ${backupJob.id}`);
        } catch (fallbackError) {
          console.error(`💥 Even fallback attempt failed:`, fallbackError);
          
          // As last resort, use a setTimeout as backup
          this.scheduleBackupTimer(
            jobDetails.groupId, 
            `emergency-${jobDetails.groupId}`, 
            jobDetails.options.delay || DEFAULT_GRACE_PERIOD_MS
          );
        }
      }

    } catch (error) {
      console.error(`🚨 CRITICAL ERROR: Failed to add job to queue:`, {
        groupId: jobDetails.groupId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      });
      
      // Last-ditch fallback attempt with different options
      try {
        console.log(`🔄 Attempting last-ditch direct queue operation...`);
        const backupJob = await contributionQueue.add(
          "start-contribution", 
          { 
            groupId: jobDetails.groupId, 
            emergency: true
          },
          { 
            attempts: 3, 
            jobId: `emergency-${jobDetails.groupId}-${Date.now()}` 
          }
        );
        console.log(`✅ Emergency job added: ${backupJob.id}`);
      } catch (fallbackError) {
        console.error(`💥 All attempts failed:`, fallbackError);
        
        // As absolute last resort, use a setTimeout backup
        this.scheduleBackupTimer(
          jobDetails.groupId, 
          `final-emergency-${jobDetails.groupId}`, 
          jobDetails.options.delay || DEFAULT_GRACE_PERIOD_MS
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Log scheduled job to the database for recovery purposes
   */
  private static async logScheduledJob(
    groupId: string, 
    jobId: string, 
    scheduledTime: Date, 
    delayMs: number
  ): Promise<void> {
    try {
      await db.scheduledJobLog.create({
        data: {
          groupId,
          jobId,
          jobType: 'CONTRIBUTION_CYCLE',
          scheduledTime,
          delayMs,
          status: 'SCHEDULED',
          metadata: JSON.stringify({
            scheduledAt: new Date().toISOString(),
            expectedRunTime: new Date(Date.now() + delayMs).toISOString()
          })
        }
      });
      console.log(`✅ Logged scheduled job ${jobId} to database for recovery`);
    } catch (error) {
      console.error(`❌ Failed to log scheduled job to database:`, error);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Schedule a backup timer as an emergency fallback
   * This ensures jobs run even if Redis fails
   */
  private static scheduleBackupTimer(
    groupId: string, 
    jobId: string, 
    delayMs: number
  ): void {
    console.log(`🔄 Setting up backup timer for group ${groupId} (delay: ${delayMs}ms)`);
    
    // Create a timeout that will trigger the job if Bull queue fails
    const backupTimer = setTimeout(async () => {
      try {
        console.log(`⏰ Backup timer triggered for group ${groupId}`);
        
        // Check if the job already ran via the normal queue
        const jobLog = await db.scheduledJobLog.findFirst({
          where: {
            groupId,
            status: { in: ['COMPLETED', 'PROCESSING'] }
          },
          orderBy: { updatedAt: 'desc' }
        });
        
        if (jobLog && jobLog.status === 'COMPLETED') {
          console.log(`✅ Job already completed via normal queue, backup not needed`);
          return;
        }
        
        if (jobLog && jobLog.status === 'PROCESSING' && 
            jobLog.updatedAt > new Date(Date.now() - 10 * 60 * 1000)) {
          console.log(`✅ Job currently processing via normal queue, backup not needed`);
          return;
        }
        
        // Check if the group is still active and needs processing
        const group = await db.group.findUnique({
          where: { id: groupId },
          select: { 
            status: true, 
            cyclesCompleted: true,
            nextCycleDate: true
          }
        });
        
        if (!group || group.status !== GroupStatus.Active || group.cyclesCompleted) {
          console.log(`⚠️ Group ${groupId} no longer needs processing (status: ${group?.status}, completed: ${group?.cyclesCompleted})`);
          return;
        }
        
        console.log(`🔥 BACKUP EXECUTION: Directly calling contrib cycle for group ${groupId}`);
        
        // Create a backup job log
        await db.scheduledJobLog.create({
          data: {
            groupId,
            jobId: `backup-${jobId}`,
            jobType: 'BACKUP_CONTRIBUTION_CYCLE',
            scheduledTime: new Date(),
            delayMs: 0,
            status: 'PROCESSING',
            metadata: JSON.stringify({
              backupTriggeredAt: new Date().toISOString(),
              originalJobId: jobId
            })
          }
        });
        
        // Import the processor directly to avoid Bull queue
        const { processContributionCycle } = await import('../queue/processors');
        
        // Call the processor directly with a fake job object
        await processContributionCycle({
          id: `backup-${jobId}`,
          data: { 
            groupId, 
            timestamp: new Date().toISOString(),
            backupTimer: true
          },
          opts: { },
          queue: { name: 'backup-timer' } as any,
          // Other required Bull.Job properties as minimal implementation
          progress: () => Promise.resolve(0),
          log: (message: string) => {
            console.log(`[Backup Job ${jobId}]: ${message}`);
            return Promise.resolve();
          },
          update: () => Promise.resolve(),
          remove: () => Promise.resolve(),
          retry: () => Promise.resolve(),
          discard: () => Promise.resolve(),
          finished: () => Promise.resolve()
        } as any);
        
        // Update the job log to completed
        await db.scheduledJobLog.updateMany({
          where: {
            groupId,
            jobId: `backup-${jobId}`
          },
          data: {
            status: 'COMPLETED',
            metadata: JSON.stringify({
              backupTriggeredAt: new Date().toISOString(),
              originalJobId: jobId,
              completedAt: new Date().toISOString()
            })
          }
        });
        
        console.log(`✅ Backup execution completed successfully`);
        
        // Record this backup execution in metrics
        MetricsService.recordQueueEvent('scheduler', 'backup_timer_executed');
        
      } catch (error) {
        console.error(`❌ Error in backup timer execution:`, error);
        
        // Record the error
        MetricsService.recordJobFailure(
          'scheduler', 
          'backupTimer', 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }, delayMs);
    
    // Store the timer reference for potential cancellation during shutdown
    const timerKey = `backup-${groupId}-${jobId}`;
    this.scheduledTimers.set(timerKey, backupTimer);
    
    // Create a database record of this backup timer
    this.logBackupTimer(groupId, jobId, delayMs);
  }
  
  /**
   * Log backup timer to database for tracking
   */
  private static async logBackupTimer(
    groupId: string, 
    jobId: string, 
    delayMs: number
  ): Promise<void> {
    try {
      await db.scheduledJobLog.create({
        data: {
          groupId,
          jobId: `backup-timer-${jobId}`,
          jobType: 'BACKUP_TIMER',
          scheduledTime: new Date(Date.now() + delayMs),
          delayMs,
          status: 'SCHEDULED',
          metadata: JSON.stringify({
            scheduledAt: new Date().toISOString(),
            expectedRunTime: new Date(Date.now() + delayMs).toISOString(),
            backupFor: jobId
          })
        }
      });
    } catch (error) {
      console.error(`❌ Failed to log backup timer to database:`, error);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Utility method to build future cycle dates based on frequency
   */
  static buildFutureCycleDates(
    start: Date,
    frequency: Frequency,
    cycleCount: number
  ): Date[] {
    const result: Date[] = [];
    let current = new Date(start);

    for (let i = 0; i < cycleCount; i++) {
      result.push(new Date(current));

      switch (frequency) {
        case Frequency.Weekly:
          current = addWeeks(current, 1);
          break;
        case Frequency.BiWeekly:
          current = addWeeks(current, 2);
          break;
        case Frequency.Monthly:
          current = addMonths(current, 1);
          break;
        default:
          throw new Error(`Unsupported frequency: ${frequency}`);
      }
    }
    return result;
  }
  
  /**
   * Clean up all timers during shutdown
   */
  static cleanupTimers(): void {
    console.log(`🧹 Cleaning up ${this.scheduledTimers.size} scheduled timers`);
    
    for (const [key, timer] of this.scheduledTimers.entries()) {
      clearTimeout(timer);
      console.log(`✓ Cleared timer ${key}`);
    }
    
    this.scheduledTimers.clear();
    this.scheduledGroups.clear();
    
    console.log(`✅ All timers cleaned up`);
  }
  
  /**
   * Recover scheduled jobs from database
   * This should be called at startup by the recovery service
   */
  static async recoverScheduledJobs(): Promise<number> {
    console.log(`🔄 Recovering scheduled jobs from database`);
    
    try {
      // Get recently scheduled jobs that may have been lost
      const scheduledJobs = await db.scheduledJobLog.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledTime: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { scheduledTime: 'asc' }
      });
      
      console.log(`Found ${scheduledJobs.length} scheduled jobs to recover`);
      
      let recoveredCount = 0;
      const now = new Date();
      
      for (const job of scheduledJobs) {
        try {
          // Skip non-contribution jobs
          if (job.jobType !== 'CONTRIBUTION_CYCLE' && job.jobType !== 'BACKUP_TIMER') {
            continue;
          }
          
          // Calculate new delay based on original scheduled time
          const originalScheduledTime = new Date(job.scheduledTime);
          let delay = originalScheduledTime.getTime() - now.getTime();
          
          // If the time has passed, schedule for immediate execution with a small buffer
          if (delay <= 0) {
            delay = DEFAULT_GRACE_PERIOD_MS;
          }
          
          console.log(`Recovering job for group ${job.groupId} (original schedule: ${originalScheduledTime.toISOString()}), new delay: ${delay}ms`);
          
          // Call scheduleContributionCycle with the recovered job
          await this.scheduleContributionCycle(job.groupId, {
            forceLock: true,
            retryAttempt: 0
          });
          
          // Update the job status to RECOVERED
          await db.scheduledJobLog.update({
            where: { id: job.id },
            data: {
              status: 'RECOVERED',
              metadata: JSON.stringify({
                originalScheduledTime: job.scheduledTime,
                recoveredAt: new Date().toISOString(),
                newDelay: delay
              })
            }
          });
          
          recoveredCount++;
        } catch (error) {
          console.error(`Failed to recover scheduled job ${job.id} for group ${job.groupId}:`, error);
          
          // Update the job status to RECOVERY_FAILED
          await db.scheduledJobLog.update({
            where: { id: job.id },
            data: {
              status: 'RECOVERY_FAILED',
              metadata: JSON.stringify({
                originalScheduledTime: job.scheduledTime,
                failedAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          });
        }
      }
      
      console.log(`✅ Successfully recovered ${recoveredCount} scheduled jobs`);
      return recoveredCount;
    } catch (error) {
      console.error(`❌ Failed to recover scheduled jobs:`, error);
      return 0;
    }
  }
}