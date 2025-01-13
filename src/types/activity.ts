import { MembershipStatus } from '@prisma/client';

export interface BaseActivity {
  id: string;
  type: 'MEMBERSHIP' | 'PAYOUT' | 'MESSAGE';
  createdAt: Date;
  groupName: string;
}

export interface MembershipActivity extends BaseActivity {
  type: 'MEMBERSHIP';
  status: MembershipStatus;
  user: {
    firstName: string;
    lastName: string;
  };
}

export interface PayoutActivity extends BaseActivity {
  type: 'PAYOUT';
  amount: any; // using 'any' for Prisma Decimal compatibility
  user: {
    firstName: string;
    lastName: string;
  };
}

export interface MessageActivity extends BaseActivity {
  type: 'MESSAGE';
  sender: {
    firstName: string;
    lastName: string;
  };
}

export type Activity = MembershipActivity | PayoutActivity | MessageActivity;

export function isMembershipActivity(activity: Activity): activity is MembershipActivity {
  return activity.type === 'MEMBERSHIP';
}

export function isPayoutActivity(activity: Activity): activity is PayoutActivity {
  return activity.type === 'PAYOUT';
}

export function isMessageActivity(activity: Activity): activity is MessageActivity {
  return activity.type === 'MESSAGE';
}