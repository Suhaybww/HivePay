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
  hasBeenPaid: boolean;
};

// The main GroupWithStats shape
export interface GroupWithStats {
  id: string;
  name: string;
  description: string | null;
  createdById: string;

  // numeric fields as strings
  contributionAmount: string | null;

  cycleFrequency: Frequency | null;
  nextCycleDate: string | null;

  cycleStarted: boolean;
  status: GroupStatus;
  pauseReason?: string | null;

  // group stats
  _count: {
    groupMemberships: number;
  };
  totalContributions: string;
  currentBalance: string;

  // Admin
  isAdmin: boolean;

  // The active members in this group
  members: GroupMember[];

  // NEW Payment columns
  totalDebitedAmount?: string | null;
  totalPendingAmount?: string | null;
  totalSuccessAmount?: string | null;
}

// For scheduled events
export interface ScheduledEvent {
  id: string;
  scheduledFor: Date;
}

/**
 * The shape returned by `getGroupSchedule`.
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