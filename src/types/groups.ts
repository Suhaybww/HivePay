
import { PayoutOrderMethod, Frequency, Gender } from '@prisma/client';


export type GroupMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | null;  // Use Prisma's Gender enum
  isAdmin: boolean;
  payoutOrder: number;  
  stripeAccountId: string | null;  // Changed from stripeCustomerId

};

export type GroupWithStats = {
  id: string;
  name: string;
  description?: string | null;
  createdById: string;
  payoutOrderMethod: PayoutOrderMethod;
  contributionAmount?: string | null; // Converted to string in backend
  contributionFrequency?: Frequency | null;
  payoutFrequency?: Frequency | null;
  nextContributionDate?: string | null; // Converted to ISO string in backend
  nextPayoutDate?: string | null; // Converted to ISO string in backend
  _count: {
    groupMemberships: number;
  };
  totalContributions: string;
  currentBalance: string;
  isAdmin: boolean;
  members: GroupMember[]; 

};
