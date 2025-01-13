// import { PrismaClient, TransactionType, PaymentStatus, MembershipStatus, Frequency, PayoutOrderMethod, GroupStatus, SubscriptionStatus, OnboardingStatus, BECSSetupStatus } from '@prisma/client';
// import { Decimal } from '@prisma/client/runtime/library';
// import { addDays } from 'date-fns';

// const prisma = new PrismaClient();

// async function main() {
//   // Use the specific user ID you want
//   const userId = 'kp_be5bcc4a8a21402abd13e7649160057a';
//   const userEmail = 'suhaybw1@gmail.com'; // Replace with a real email you can check
//   const CONTRIBUTION_AMOUNT = new Decimal(100);

//   // Clear previous test data in correct order
//   await prisma.transaction.deleteMany();
//   await prisma.payment.deleteMany();
//   await prisma.payout.deleteMany();
//   await prisma.groupMembership.deleteMany();
//   await prisma.group.deleteMany();
//   await prisma.notification.deleteMany();
//   await prisma.user.deleteMany();

//   // Create the specified test user
//   await prisma.user.create({
//     data: {
//       id: userId,
//       firstName: 'Test',
//       lastName: 'User',
//       email: userEmail,
//       phoneNumber: '0000000000',  // must be valid length per your schema
//       subscriptionStatus: SubscriptionStatus.Active,
//       onboardingStatus: OnboardingStatus.Completed,
//       becsSetupStatus: BECSSetupStatus.Completed,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       isDeleted: false,
//     },
//   });

//   // Set the next contribution date to 2 days from now
//   // This aligns with the logic in your contribution-reminder GET handler
//   const group = await prisma.group.create({
//     data: {
//       name: 'Test ROSCA Group',
//       description: 'A test group for contribution reminders',
//       createdById: userId,
//       payoutOrderMethod: PayoutOrderMethod.Admin_Selected,
//       contributionAmount: CONTRIBUTION_AMOUNT,
//       contributionFrequency: Frequency.Monthly,
//       payoutFrequency: Frequency.Monthly,
//       nextContributionDate: addDays(new Date(), 2),
//       nextPayoutDate: addDays(new Date(), 7),
//       cycleStarted: true,
//       status: GroupStatus.Active,
//     },
//   });

//   // Add the user as a member
//   await prisma.groupMembership.create({
//     data: {
//       groupId: group.id,
//       userId: userId,
//       isAdmin: true,
//       payoutOrder: 1,
//       status: MembershipStatus.Active,
//       acceptedTOSAt: new Date(),
//     },
//   });

//   // Create a past successful payment from the user
//   await prisma.payment.create({
//     data: {
//       userId,
//       groupId: group.id,
//       amount: CONTRIBUTION_AMOUNT,
//       status: PaymentStatus.Successful,
//       paymentDate: addDays(new Date(), -30),
//       stripePaymentIntentId: `pi_test_${Math.random().toString(36).substring(2, 11)}`,
//     },
//   });

//   console.log('Seed data created successfully!');
//   console.log('Group ID:', group.id);
//   console.log('User ID:', userId);
//   console.log('User Email:', userEmail);
//   console.log('Next contribution date:', group.nextContributionDate);
// }

// main()
//   .catch((e) => {
//     console.error('Error seeding data:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
