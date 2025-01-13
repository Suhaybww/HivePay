import { Frequency, Gender, GroupStatus } from "@prisma/client";

// Basic info for group members
export type GroupMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | null;
  isAdmin: boolean;
  payoutOrder: number;
  stripeAccountId: string | null;
  hasBeenPaid:  boolean;
};

// The main GroupWithStats shape
export interface GroupWithStats {
  id: string;
  name: string;
  description: string | null;
  createdById: string;

  // For convenience, store numeric fields as strings
  contributionAmount: string | null;

  // Single cycle frequency (Weekly, BiWeekly, or Monthly)
  cycleFrequency: Frequency | null;

  // Single date used for both the next contribution + payout
  nextCycleDate: string | null;

  cycleStarted: boolean;
  status: GroupStatus;
  pauseReason?: string | null;

  // For group stats
  _count: {
    groupMemberships: number;
  };
  totalContributions: string; // existing field
  currentBalance: string;     // existing field

  // Admin
  isAdmin: boolean;

  // The active (or relevant) members in this group
  members: GroupMember[];

  // ===== NEW Payment columns (recently added) =====
  /**
   * totalDebitedAmount: sum of all Payment amounts that are not "Failed"
   * totalPendingAmount: sum of all Payment amounts where status=Pending
   * totalSuccessAmount: sum of all Payment amounts where status=Successful
   * 
   * These can be string or null, depending on how your DB or code returns them.
   */
  totalDebitedAmount?: string | null;
  totalPendingAmount?: string | null;
  totalSuccessAmount?: string | null;
}

// For scheduled events (if needed)
export interface ScheduledEvent {
  id: string;
  scheduledFor: Date;
}

/**
 * The shape returned by `getGroupSchedule`.
 * 
 * We have `futureCycleDates` (string[]) 
 * and `currentSchedule` describing the single `nextCycleDate`.
 */
export interface GroupSchedule {
  futureCycleDates: string[];
  currentSchedule: {
    nextCycleDate: string | null;
    cycleFrequency: Frequency | null;
    contributionAmount: string | null;
    status: GroupStatus;
    cycleStarted: boolean;
  };
}
