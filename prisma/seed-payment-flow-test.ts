// /**
//  * prisma/seed-payment-flow-test.ts
//  * --------------------------------
//  * This script seeds the DB with test users, a group, and triggers the payment flow
//  * (startContributionCycle + processPayout) to confirm your logic works end-to-end.
//  *
//  * NOTE: We removed all "delete" operations, so this file won't clear the DB first.
//  *       We also ensure we pass a full `Context` object to .createCaller(...), including `db`.
//  *
//  * Usage:
//  *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-payment-flow-test.ts
//  */

// import 'tsconfig-paths/register';
// import { randomUUID } from 'crypto';
// import { db } from '../src/db';
// import { cycleRouter } from '../src/trpc/routers/cycle';
// import { type Context } from '../src/trpc/trpc'; // <-- Import your Context type
// import {
//   BECSSetupStatus,
//   Frequency,
//   GroupStatus,
//   MembershipStatus,
//   SubscriptionStatus,
// } from '@prisma/client';

// async function createTestUser(params: {
//   email: string;
//   firstName: string;
//   lastName: string;
//   stripeCustomerId: string;
//   stripeBecsPaymentMethodId: string;
// }) {
//   const { email, firstName, lastName, stripeCustomerId, stripeBecsPaymentMethodId } = params;
//   return db.user.create({
//     data: {
//       id: randomUUID(),
//       email,
//       firstName,
//       lastName,
//       phoneNumber: '555-555-5555', // Provide a default phone number
//       stripeCustomerId,
//       stripeBecsPaymentMethodId,
//       becsSetupStatus: BECSSetupStatus.Completed,
//       subscriptionStatus: SubscriptionStatus.Active,
//     },
//   });
// }

// async function main() {
//   console.log('--- Starting Payment Flow Test Seed (No Deletions) ---');

//   // 1) Create or fetch some test users
//   const userA = await createTestUser({
//     email: 'suhaybw1@gmail.com',
//     firstName: 'Suhayb',
//     lastName: 'Walton',
//     stripeCustomerId: 'cus_RQ6KMcUNveMDId',
//     stripeBecsPaymentMethodId: 'pm_BecsDebit_1AliceTest',
//   });

//   const userB = await createTestUser({
//     email: 'bob@example.com',
//     firstName: 'Bob',
//     lastName: 'Test',
//     stripeCustomerId: 'cus_TEST_BOB_123',
//     stripeBecsPaymentMethodId: 'pm_BecsDebit_1BobTest',
//   });

//   const userC = await createTestUser({
//     email: 'charlie@example.com',
//     firstName: 'Charlie',
//     lastName: 'Test',
//     stripeCustomerId: 'cus_TEST_CHARLIE_123',
//     stripeBecsPaymentMethodId: 'pm_BecsDebit_1CharlieTest',
//   });

//   console.log('Created test users:', userA.email, userB.email, userC.email);

//   // 2) Create a group
//   const groupId = randomUUID();
//   const group = await db.group.create({
//     data: {
//       id: groupId,
//       name: 'Test Payment Flow Group',
//       description: 'Group for testing payment cycle logic',
//       createdById: userA.id,
//       contributionAmount: 50.0,
//       contributionFrequency: Frequency.Weekly,
//       payoutFrequency: Frequency.Weekly,
//       nextContributionDate: new Date(),
//       nextPayoutDate: new Date(),
//       status: GroupStatus.Active,
//       cycleStarted: false,
//     },
//   });

//   // 3) Add group memberships
//   await db.groupMembership.createMany({
//     data: [
//       {
//         id: randomUUID(),
//         groupId,
//         userId: userA.id,
//         payoutOrder: 1,
//         isAdmin: true,
//         status: MembershipStatus.Active,
//       },
//       {
//         id: randomUUID(),
//         groupId,
//         userId: userB.id,
//         payoutOrder: 2,
//         isAdmin: false,
//         status: MembershipStatus.Active,
//       },
//       {
//         id: randomUUID(),
//         groupId,
//         userId: userC.id,
//         payoutOrder: 3,
//         isAdmin: false,
//         status: MembershipStatus.Active,
//       },
//     ],
//   });
//   console.log('Created a test group and memberships:', group.name);

//   // 4) Build a local context that matches your `Context` type
//   //    userA is an admin in the group, so that should satisfy "privateProcedure".
//   const localCtx: Context = {
//     db,                  // from your actual db import
//     userId: userA.id,    // userA is admin
//     user: { id: userA.id }, // optionally set more fields if your code checks them
//     headers: undefined,  // or pass any desired headers
//   };

//   // 5) Manually start the contribution cycle
//   console.log('--- Calling startContributionCycle ---');
//   const startCycleResult = await cycleRouter.createCaller(localCtx).startContributionCycle({
//     groupId,
//     scheduleDate: new Date().toISOString(),
//     payoutDate: new Date().toISOString(),
//   });
//   console.log('startContributionCycle result:', startCycleResult);

//   // 6) (Optional) Attempt a payout
//   console.log('--- (Optional) Calling processPayout ---');
//   const payoutResult = await cycleRouter.createCaller(localCtx).processPayout({ groupId });
//   console.log('processPayout result:', payoutResult);

//   console.log('--- Payment Flow Test Seed Complete (No Deletions) ---');
// }

// main()
//   .catch((err) => {
//     console.error('Error running payment flow test seed:', err);
//     process.exit(1);
//   })
//   .finally(async () => {
//     db.$disconnect();
//   });
