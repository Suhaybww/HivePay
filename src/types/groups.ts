import { Frequency, Gender, GroupStatus } from '@prisma/client';

export type GroupMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | null;
  isAdmin: boolean;
  payoutOrder: number;
  stripeAccountId: string | null;
};

export interface GroupWithStats {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  contributionAmount: string | null;
  contributionFrequency: Frequency | null;
  payoutFrequency: Frequency | null;
  nextContributionDate: string | null;
  nextPayoutDate: string | null;
  cycleStarted: boolean;
  status: GroupStatus;
  _count: {
    groupMemberships: number;
  };
  totalContributions: string;
  currentBalance: string;
  isAdmin: boolean;
  members: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    gender: Gender | null;
    isAdmin: boolean;
    payoutOrder: number;
    stripeAccountId: string | null;
  }[];
}

export interface ScheduledEvent {
  id: string;
  scheduledFor: Date;
}

export interface GroupSchedule {
  currentSchedule: {
    nextContributionDate: Date | null;
    nextPayoutDate: Date | null;
    contributionFrequency: string | null;
    payoutFrequency: string | null;
    status: string;
    cycleStarted: boolean;
  };
  upcomingContributions: ScheduledEvent[];
  upcomingPayouts: ScheduledEvent[];
}