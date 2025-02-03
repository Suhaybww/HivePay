import { Frequency, Gender, GroupStatus, PayoutStatus, PaymentStatus, PauseReason } from "@prisma/client";

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
// The main GroupWithStats shape
export interface GroupWithStats {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  
  // Financials (Decimal as string)
  contributionAmount: string | null;
  totalDebitedAmount: string;
  totalPendingAmount: string;
  totalSuccessAmount: string;
  futureCyclesJson?: string[]; // Parsed from Prisma's Json type
  
  // Cycle management
  cycleFrequency: Frequency | null;
  nextCycleDate: string | null;
  cycleStarted: boolean;
  
  // Status
  status: GroupStatus;
  pauseReason: PauseReason | null;
  
  // Relationships
  members: Array<{
    id: string;
    userId: string;
    payoutOrder: number | null;
    hasBeenPaid: boolean;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
  
  // Payment relationships
  payments: Array<{
    id: string;
    amount: string;
    status: PaymentStatus;
    cycleNumber: number | null;
    createdAt: string;
  }>;
  
  // Payout relationships
  payouts: Array<{
    id: string;
    amount: string;
    status: PayoutStatus;
    payoutOrder: number | null;
    scheduledPayoutDate: string;
    createdAt: string;
  }>;
  
  // Aggregate stats
  _count: {
    groupMemberships: number;
    payments: number;
    payouts: number;
  };
  
  // Computed values
  currentBalance: string;
  isAdmin: boolean;
  nextPayoutMember?: {
    userId: string;
    payoutOrder: number;
    scheduledDate: string;
  };
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
