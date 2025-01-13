// // prisma/seed-test-deletion.ts
// import { PrismaClient, SubscriptionStatus } from '@prisma/client';
// const prisma = new PrismaClient();

// async function main() {
//   // Create test users with different deletion states
//   const testUsers = await Promise.all([
//     // User 1: Marked as deleted now
//     prisma.user.create({
//       data: {
//         id: 'test_delete_1',
//         firstName: 'Test',
//         lastName: 'Delete1',
//         email: 'test1@delete.com',
//         phoneNumber: '1234567890',
//         subscriptionStatus: SubscriptionStatus.Canceled,
//         isDeleted: true,
//         deletedAt: new Date(),
//         deletionReason: 'Test deletion - immediate'
//       }
//     }),

//     // User 2: Marked as deleted but not deleted yet
//     prisma.user.create({
//       data: {
//         id: 'test_delete_2',
//         firstName: 'Test',
//         lastName: 'Delete2',
//         email: 'test2@delete.com',
//         phoneNumber: '1234567890',
//         subscriptionStatus: SubscriptionStatus.Active,
//         isDeleted: false,
//         deletionReason: 'Not deleted yet'
//       }
//     }),

//     // User 3: Regular active user
//     prisma.user.create({
//       data: {
//         id: 'test_delete_3',
//         firstName: 'Test',
//         lastName: 'Active',
//         email: 'test3@active.com',
//         phoneNumber: '1234567890',
//         subscriptionStatus: SubscriptionStatus.Active,
//       }
//     }),
//   ]);

//   console.log('Created test users:', testUsers);
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });