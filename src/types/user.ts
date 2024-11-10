
export type SubscriptionStatus = 'Active' | 'Inactive' | 'Canceled';
export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay';
export type OnboardingStatus = 'Pending' | 'Completed' | 'Failed';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender?: Gender;
  age?: number;
  stripeCustomerId?: string;
  stripeAccountId?: string;
  subscriptionStatus: SubscriptionStatus;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeCurrentPeriodEnd?: Date;
  onboardingStatus: OnboardingStatus;
  onboardingDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
