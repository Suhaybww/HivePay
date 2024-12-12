import { PayoutOrderMethod, Frequency, Gender, GroupStatus } from '@prisma/client';

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

export type GroupWithStats = {
  id: string;
  name: string;
  description?: string | null;
  createdById: string;
  payoutOrderMethod: PayoutOrderMethod;
  contributionAmount?: string | null;
  contributionFrequency?: Frequency | null;
  payoutFrequency?: Frequency | null;
  nextContributionDate?: string | null;
  nextPayoutDate?: string | null;
  cycleStarted: boolean;
  status: GroupStatus;  
  _count: {
    groupMemberships: number;
  };
  totalContributions: string;
  currentBalance: string;
  isAdmin: boolean;
  members: GroupMember[];
};