import { db } from '@/src/db';
import { contributionQueue, payoutQueue, defaultJobOptions } from '../queue/config';
import { Frequency, GroupStatus } from '@prisma/client';
import { addDays, addWeeks, addMonths } from 'date-fns';

export class SchedulerService {
  // Calculate next date based on frequency
  private static getNextDate(currentDate: Date, frequency: Frequency): Date {
    switch (frequency) {
      case 'Daily':
        return addDays(currentDate, 1);
      case 'Weekly':
        return addWeeks(currentDate, 1);
      case 'BiWeekly':
        return addWeeks(currentDate, 2);
      case 'Monthly':
        return addMonths(currentDate, 1);
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }

  // Schedule contribution cycle for a group
  static async scheduleContributionCycle(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        contributionFrequency: true,
        nextContributionDate: true,
        status: true
      }
    });

    if (!group || !group.contributionFrequency || group.status !== GroupStatus.Active) {
      console.log(`Invalid group or inactive status for scheduling: ${groupId}`);
      return;
    }

    const nextDate = group.nextContributionDate || new Date();
    const delay = nextDate.getTime() - Date.now();

    if (delay < 0) {
      console.log(`Scheduled date is in the past for group ${groupId}, adjusting to next cycle`);
      const adjustedDate = this.getNextDate(new Date(), group.contributionFrequency);
      await this.updateGroupNextContributionDate(groupId, adjustedDate);
      return this.scheduleContributionCycle(groupId);
    }

    // Schedule the contribution job
    await contributionQueue.add(
      'start-contribution',
      { groupId },
      {
        ...defaultJobOptions,
        delay,
        jobId: `contribution-${groupId}-${nextDate.getTime()}`
      }
    );

    console.log(`Scheduled contribution cycle for group ${groupId} at ${nextDate}`);
  }

  // Schedule payout for a group
  static async schedulePayoutProcessing(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        payoutFrequency: true,
        nextPayoutDate: true,
        status: true
      }
    });

    if (!group || !group.payoutFrequency || group.status !== GroupStatus.Active) {
      console.log(`Invalid group or inactive status for scheduling payout: ${groupId}`);
      return;
    }

    const nextDate = group.nextPayoutDate || new Date();
    const delay = nextDate.getTime() - Date.now();

    if (delay < 0) {
      console.log(`Scheduled payout date is in the past for group ${groupId}, adjusting to next cycle`);
      const adjustedDate = this.getNextDate(new Date(), group.payoutFrequency);
      await this.updateGroupNextPayoutDate(groupId, adjustedDate);
      return this.schedulePayoutProcessing(groupId);
    }

    // Schedule the payout job
    await payoutQueue.add(
      'process-payout',
      { groupId },
      {
        ...defaultJobOptions,
        delay,
        jobId: `payout-${groupId}-${nextDate.getTime()}`
      }
    );

    console.log(`Scheduled payout for group ${groupId} at ${nextDate}`);
  }

  // Update group's next contribution date
  private static async updateGroupNextContributionDate(groupId: string, nextDate: Date): Promise<void> {
    await db.group.update({
      where: { id: groupId },
      data: { nextContributionDate: nextDate }
    });
  }

  // Update group's next payout date
  private static async updateGroupNextPayoutDate(groupId: string, nextDate: Date): Promise<void> {
    await db.group.update({
      where: { id: groupId },
      data: { nextPayoutDate: nextDate }
    });
  }

  // Schedule next cycle after completion
  static async scheduleNextCycle(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        contributionFrequency: true,
        payoutFrequency: true,
        nextContributionDate: true,
        nextPayoutDate: true,
        status: true
      }
    });

    if (!group || group.status !== GroupStatus.Active) return;

    // Schedule next contribution cycle
    if (group.contributionFrequency) {
      const nextContributionDate = this.getNextDate(
        group.nextContributionDate || new Date(),
        group.contributionFrequency
      );
      await this.updateGroupNextContributionDate(groupId, nextContributionDate);
      await this.scheduleContributionCycle(groupId);
    }

    // Schedule next payout
    if (group.payoutFrequency) {
      const nextPayoutDate = this.getNextDate(
        group.nextPayoutDate || new Date(),
        group.payoutFrequency
      );
      await this.updateGroupNextPayoutDate(groupId, nextPayoutDate);
      await this.schedulePayoutProcessing(groupId);
    }
  }
}