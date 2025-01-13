import { db } from "@/src/db";
import { contributionQueue, defaultJobOptions } from "../queue/config";
import { GroupStatus } from "@prisma/client"; // <— we no longer need Frequency here
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export class SchedulerService {
  private static readonly TIMEZONE = "Australia/Melbourne";

  /**
   * scheduleContributionCycle
   * Called right away after scheduleGroupCycles, or after finishing a cycle,
   * to queue up the next run of "start-contribution" at `group.nextCycleDate`.
   */
  static async scheduleContributionCycle(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: {
        nextCycleDate: true,
        status: true,
      },
    });

    if (!group || group.status !== GroupStatus.Active) {
      console.log(`Invalid or inactive group for scheduling: ${groupId}`);
      return;
    }

    // If nextCycleDate missing or in the past => immediate
    if (!group.nextCycleDate) {
      console.log(`No nextCycleDate => forcing immediate for group ${groupId}`);
      await contributionQueue.add("start-contribution", { groupId }, {
        ...defaultJobOptions,
        delay: 0,
        jobId: `contribution-${groupId}-now`
      });
      return;
    }

    const nextDateInMelbourne = toZonedTime(group.nextCycleDate, this.TIMEZONE);
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
      console.log(`(TESTING) nextCycleDate is in the past => forcing delay=0.`);
      delay = 0;
    }

    // Add job => 'start-contribution'
    await contributionQueue.add(
      "start-contribution",
      { groupId },
      {
        ...defaultJobOptions,
        delay,
        jobId: `contribution-${groupId}-${nextDateUTC.getTime()}`,
      }
    );

    console.log(
      `Scheduled next cycle for group ${groupId} at`,
      formatInTimeZone(nextDateUTC, this.TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")
    );
  }

  /**
   * scheduleNextCycle
   * Previously we were adding frequency increments. 
   * Now we simply read the nextCycleDate from futureCyclesJson in the processor
   * and store it in the group. We just re-schedule that date. No additional increments.
   */
  static async scheduleNextCycle(groupId: string): Promise<void> {
    // The group’s code updates `nextCycleDate` from `futureCyclesJson`.
    // So we just re-queue it if still active.
    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.status !== GroupStatus.Active) {
      console.log(`Group ${groupId} is not active => skip scheduleNextCycle.`);
      return;
    }

    // We rely on the updated nextCycleDate from the DB
    await this.scheduleContributionCycle(groupId);
  }
}
