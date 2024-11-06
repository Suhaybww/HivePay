// src/types/user.ts
export type SubscriptionStatus = 'Active' | 'Inactive' | 'Canceled';
export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay';
export type VerificationMethod = 'ID' | 'Passport' | 'DriversLicense';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  emailVerified: boolean;
  gender?: Gender;
  age?: number;
  passwordHash: string;
  stripeCustomerId?: string;
  stripeAccountId?: string;
  subscriptionStatus: SubscriptionStatus;
  idVerified: boolean;
  verificationMethod?: VerificationMethod;
  twoFactorEnabled: boolean;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeCurrentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}