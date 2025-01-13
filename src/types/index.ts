import { Payment, Group, Transaction } from '@prisma/client';

export interface DashboardPaymentHistory {
  payments: Payment[];
  averageMonthlyPayment: number;
  successRate: number;
}

export interface SavingsStats {
  totalContributed: number;
  expectedPayout: number;
}

export interface GroupWithMemberCount extends Group {
  _count?: {
    groupMemberships?: number;
  };
}

export interface TransactionWithDetails extends Transaction {
  group: Group;
  description: string;
}