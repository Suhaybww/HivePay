import { db } from "@/src/db";
import { contributionQueue, defaultJobOptions } from "../queue/config";
import { GroupStatus } from "@prisma/client";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export class SchedulerService {
  private static readonly TIMEZONE = "Australia/Melbourne";

  /**
   * scheduleContributionCycle
   * - we read `group.nextCycleDate`:
   *   if it’s absent or in past => immediate
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
      console.log(`Invalid/inactive group => skip scheduling. groupId=${groupId}`);
      return;
    }

    if (!group.nextCycleDate) {
      console.log(`No nextCycleDate => schedule immediate run for groupId=${groupId}`);
      await contributionQueue.add("start-contribution", { groupId }, {
        ...defaultJobOptions,
        delay: 0,
        jobId: `contribution-${groupId}-immediate`,
      });
      return;
    }

    // Convert nextCycleDate => local => UTC => calculate delay
    const localDate = toZonedTime(group.nextCycleDate, this.TIMEZONE);
    const nextDateUTC = new Date(Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds()
    ));

    let delay = nextDateUTC.getTime() - Date.now();
    if (delay < 0) {
      console.log(`(TEST) nextCycleDate < now => forced delay=0 => immediate run.`);
      delay = 0;
    }

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
      `Scheduled cycle for group=${groupId} at`,
      formatInTimeZone(nextDateUTC, this.TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")
    );
  }

  /**
   * scheduleNextCycle
   * - Called after processContributionCycle sets `group.nextCycleDate` from `futureCyclesJson`.
   */
  static async scheduleNextCycle(groupId: string): Promise<void> {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== GroupStatus.Active) {
      console.log(`Group not active => skip. groupId=${groupId}`);
      return;
    }

    // just re-call scheduleContributionCycle
    await this.scheduleContributionCycle(groupId);
  }
}
