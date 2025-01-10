// src/lib/services/SchedulerService.ts
import { db } from '@/src/db';
import { contributionQueue, defaultJobOptions } from '../queue/config';
import { Frequency, GroupStatus } from '@prisma/client';
import { addWeeks, addMonths } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export class SchedulerService {
  private static readonly TIMEZONE = 'Australia/Melbourne';

  /**
   * getNextDate
   * Takes the current date & the Frequency => returns a new date in UTC
   */
  private static getNextDate(currentDate: Date, frequency: Frequency): Date {
    const melbourneDate = toZonedTime(currentDate, this.TIMEZONE);
    let nextDate: Date;

    switch (frequency) {
      case 'Weekly':
        nextDate = addWeeks(melbourneDate, 1);
        break;
      case 'BiWeekly':
        nextDate = addWeeks(melbourneDate, 2);
        break;
      case 'Monthly':
        nextDate = addMonths(melbourneDate, 1);
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    // Convert back to UTC
    return new Date(Date.UTC(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate(),
      nextDate.getHours(),
      nextDate.getMinutes(),
      nextDate.getSeconds(),
      nextDate.getMilliseconds()
    ));
  }

  /**
   * scheduleContributionCycle
   * Called right away after scheduleGroupCycles, or after finishing a cycle,
   * to queue up the next run of "start-contribution".
   */
  static async scheduleContributionCycle(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        cycleFrequency: true,
        nextCycleDate: true,
        status: true,
      },
    });

    if (!group || !group.cycleFrequency || group.status !== GroupStatus.Active) {
      console.log(`Invalid or inactive group for scheduling: ${groupId}`);
      return;
    }

    // If group.nextCycleDate is not set or is in the past, we do immediate or fix it
    const nextDateInMelbourne = group.nextCycleDate
      ? toZonedTime(group.nextCycleDate, this.TIMEZONE)
      : toZonedTime(new Date(), this.TIMEZONE);

    let nextDateUTC = new Date(Date.UTC(
      nextDateInMelbourne.getFullYear(),
      nextDateInMelbourne.getMonth(),
      nextDateInMelbourne.getDate(),
      nextDateInMelbourne.getHours(),
      nextDateInMelbourne.getMinutes(),
      nextDateInMelbourne.getSeconds()
    ));

    let delay = nextDateUTC.getTime() - Date.now();

    if (delay < 0) {
      console.log(`(TESTING) nextCycleDate is in the past. Forcing delay=0 immediately.`);
      delay = 0;
    }

    // Add job => 'start-contribution'
    await contributionQueue.add(
      'start-contribution',
      { groupId },
      {
        ...defaultJobOptions,
        delay,
        jobId: `contribution-${groupId}-${nextDateUTC.getTime()}`,
      }
    );

    console.log(
      `Scheduled next cycle for group ${groupId} at`,
      formatInTimeZone(nextDateUTC, this.TIMEZONE, 'yyyy-MM-dd HH:mm:ss zzz')
    );
  }

  /**
   * scheduleNextCycle
   * If the group is still active & started, we push nextCycleDate forward
   * by 1 frequency interval => then re-schedule the queue.
   */
  static async scheduleNextCycle(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        cycleFrequency: true,
        nextCycleDate: true,
        status: true,
      },
    });
    if (!group || group.status !== GroupStatus.Active) {
      return;
    }

    if (!group.cycleFrequency) {
      console.log(`No cycleFrequency set for group ${groupId}; skipping next cycle scheduling.`);
      return;
    }

    const nextCycleDate = group.nextCycleDate || new Date();

    // Move it forward by 1 frequency cycle
    const nextDateUTC = this.getNextDate(nextCycleDate, group.cycleFrequency);

    await db.group.update({
      where: { id: groupId },
      data: {
        nextCycleDate: nextDateUTC,
      },
    });

    await this.scheduleContributionCycle(groupId);
  }
}
