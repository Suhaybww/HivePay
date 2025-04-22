// src/services/schedulerService.ts
import { db } from "@/src/db";
import { defaultJobOptions } from "../queue/config";
import { contributionQueue } from "../queue/contributionQueue";
import { GroupStatus } from "@prisma/client";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export class SchedulerService {
  private static readonly TIMEZONE = "Australia/Melbourne";
  private static readonly JOB_PREFIX = "contribution";
  private static scheduledGroups = new Set<string>();

  /**
   * scheduleContributionCycle - Enhanced with date validation, cycle advancement,
   * and deduplication logic
   */
  static async scheduleContributionCycle(groupId: string): Promise<void> {
    try {
      console.log(`🔍 DEBUG: scheduleContributionCycle called for group ${groupId}`);
      
      // Prevent duplicate scheduling
      if (this.scheduledGroups.has(groupId)) {
        console.log(`🔄 Group ${groupId} already has a scheduled job, skipping`);
        return;
      }

      console.log(`🔄 Starting schedule process for group ${groupId}`);
      
      const group = await db.group.findUnique({
        where: { id: groupId },
        select: { 
          nextCycleDate: true, 
          status: true,
          cycleStarted: true,
          cyclesCompleted: true,
          name: true
        },
      });

      console.log(`🔍 DEBUG: Group state from database:`, {
        groupId,
        nextCycleDate: group?.nextCycleDate,
        status: group?.status,
        cycleStarted: group?.cycleStarted,
        cyclesCompleted: group?.cyclesCompleted,
        name: group?.name
      });

      if (!group) {
        console.error(`❌ Group ${groupId} not found`);
        return;
      }

      if (group.status !== GroupStatus.Active) {
        console.log(`⏸️  Group ${groupId} is not active (status: ${group.status})`);
        return;
      }

      // Check if cycle is already started to prevent double-processing
      if (group.cycleStarted) {
        console.log(`⏸️  Group ${groupId} cycle already started, skipping scheduling`);
        return;
      }

      if (group.cyclesCompleted) {
        console.log(`⏸️  Group ${groupId} cycles already completed, skipping scheduling`);
        return;
      }

      // Mark this group as scheduled
      this.scheduledGroups.add(groupId);
      console.log(`🔍 DEBUG: Added group ${groupId} to scheduledGroups set (size: ${this.scheduledGroups.size})`);

      const jobDetails = {
        groupId,
        options: {
          ...defaultJobOptions,
          jobId: `${this.JOB_PREFIX}-${groupId}-${Date.now()}`
        }
      };

      console.log(`🔍 DEBUG: Calculating next run for group ${groupId} with nextCycleDate:`, group.nextCycleDate);
      const { nextRun, delay } = await this.calculateAndSetNextRun(groupId, group.nextCycleDate);
      
      jobDetails.options.delay = delay;

      console.log(`⏰ Scheduling next run for group ${groupId}:`, {
        scheduledTime: formatInTimeZone(nextRun, this.TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz"),
        delayMs: delay,
        jobId: jobDetails.options.jobId
      });

      // Set a timeout to remove group from scheduled set
      setTimeout(() => {
        this.scheduledGroups.delete(groupId);
        console.log(`🔄 Removed group ${groupId} from scheduled set after timeout`);
      }, delay + 5000); // Add 5 seconds buffer

      await this.addQueueJob(jobDetails);
      
    } catch (error) {
      // Remove group from scheduledGroups in case of error
      this.scheduledGroups.delete(groupId);
      console.error(`‼️ Failed to schedule group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * scheduleNextCycle - With cycle validation and date advancement
   */
  static async scheduleNextCycle(groupId: string): Promise<void> {
    try {
      console.log(`🔍 DEBUG: scheduleNextCycle called for group ${groupId}`);

      // Prevent duplicate scheduling
      if (this.scheduledGroups.has(groupId)) {
        console.log(`🔄 Group ${groupId} already has a scheduled next cycle, skipping`);
        return;
      }

      console.log(`🔁 Attempting to schedule next cycle for group ${groupId}`);
      
      const group = await db.group.findUnique({
        where: { id: groupId },
        select: { 
          status: true,
          nextCycleDate: true,
          cycleStarted: true,
          cyclesCompleted: true
        },
      });

      console.log(`🔍 DEBUG: Group state in scheduleNextCycle:`, {
        groupId,
        status: group?.status,
        nextCycleDate: group?.nextCycleDate,
        cycleStarted: group?.cycleStarted,
        cyclesCompleted: group?.cyclesCompleted
      });

      if (!group) {
        console.error(`❌ Group ${groupId} not found during next cycle scheduling`);
        return;
      }

      if (group.status !== GroupStatus.Active) {
        console.log(`⏸️  Skipping inactive group: ${groupId} (status: ${group.status})`);
        return;
      }

      // Check if cycle is already started to prevent double-processing
      if (group.cycleStarted) {
        console.log(`⏸️  Group ${groupId} cycle already started, skipping scheduling`);
        return;
      }

      if (group.cyclesCompleted) {
        console.log(`⏸️  Group ${groupId} cycles already completed, skipping scheduling`);
        return;
      }

      console.log(`✅ Validations passed, proceeding to schedule group ${groupId}`);
      await this.scheduleContributionCycle(groupId);
      
    } catch (error) {
      console.error(`‼️ Next cycle scheduling failed for group ${groupId}:`, error);
      throw error;
    }
  }

  private static async calculateAndSetNextRun(
    groupId: string,
    currentDate: Date | null
  ): Promise<{ nextRun: Date; delay: number }> {
    console.log(`🔍 DEBUG: calculateAndSetNextRun for group ${groupId} with currentDate:`, currentDate);
    
    const now = new Date();
    let nextRun = currentDate ? new Date(currentDate) : new Date();
    
    console.log(`🔍 DEBUG: Initial nextRun:`, nextRun);
    console.log(`🔍 DEBUG: Current time:`, now);
    console.log(`🔍 DEBUG: Is nextRun in the past?`, nextRun <= now);
    
    // Instead of advancing to the next month, use a small buffer for immediate execution
    // This respects the user's chosen date while ensuring it's in the future
    if (nextRun <= now) {
      // Add a small buffer (30 seconds) to ensure we're in the future
      nextRun = new Date(now.getTime() + 30000);
      console.log(`⏩ Setting immediate execution with buffer: ${nextRun.toISOString()}`);
    }

    // Don't update the database date - we want to keep the user's selected date
    // This way we're not overriding the user's choice with our adjusted execution time
    // The queue will still process at the adjusted time without changing the stored date

    const delay = nextRun.getTime() - Date.now();
    
    // Ensure delay is never negative and has a minimum value
    const safeDelay = Math.max(delay, 5000); // Minimum 5 seconds
    
    console.log(`🔍 DEBUG: Final nextRun:`, nextRun);
    console.log(`🔍 DEBUG: Initial delay:`, delay);
    console.log(`🔍 DEBUG: Safe delay:`, safeDelay);
    
    return { nextRun, delay: safeDelay };
  }

  private static async addQueueJob(jobDetails: {
    groupId: string;
    options: typeof defaultJobOptions & { jobId: string; delay?: number };
  }): Promise<void> {
    try {
      console.log(`🔍 DEBUG: addQueueJob called for group ${jobDetails.groupId} with options:`, jobDetails.options);
      
      // Check if queue is ready
      try {
        const isReady = await contributionQueue.isReady();
        console.log(`🔍 DEBUG: Contribution queue ready check: ${isReady}`);
      } catch (readyError) {
        console.error(`‼️ Queue ready check failed:`, readyError);
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
      
      const job = await contributionQueue.add(
        "start-contribution",
        { groupId: jobDetails.groupId },
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
        }
      } catch (verifyError) {
        console.error(`‼️ Failed to verify job addition:`, verifyError);
      }

    } catch (error) {
      console.error(`‼️ Failed to add job to queue:`, {
        groupId: jobDetails.groupId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      });
      throw error;
    }
  }
}