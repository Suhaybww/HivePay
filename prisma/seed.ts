// prisma/seed.ts
import { PrismaClient, TransactionType, PaymentStatus, PayoutStatus, MembershipStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const groupId = 'cm4f1zw4x0005rca8suyu8i8j';
const userIds = [
  'kp_2674114f61cc45cb89545c4dcca3b85c',
  'kp_0f8b647c47a04f0d9f9eac22d71ecba7',
  'kp_6408a8bd0e394203afa47dfd7c75278d',
  'kp_24119b5f20a8487fa54abd29a4b76491'  // Added original user
];

async function main() {
  // First clean up existing data for clean test
  await prisma.transaction.deleteMany({
    where: { groupId }
  });
  await prisma.payment.deleteMany({
    where: { groupId }
  });
  await prisma.payout.deleteMany({
    where: { groupId }
  });

  // Ensure all users are members
  for (let i = 0; i < userIds.length; i++) {
    await prisma.groupMembership.upsert({
      where: {
        membershipIdentifier: {
          groupId,
          userId: userIds[i]
        }
      },
      update: {},
      create: {
        groupId,
        userId: userIds[i],
        isAdmin: i === 3, // Last user (original) is admin
        payoutOrder: i + 1,
        status: MembershipStatus.Active,
        acceptedTOSAt: new Date(),
      },
    });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId }
  });

  if (!group || !group.contributionAmount) {
    throw new Error('Group not found or contribution amount not set');
  }

  // Create 6 months of payment data for each user
  const numberOfMonths = 6;
  const paymentDates = Array.from({ length: numberOfMonths }, (_, i) => 
    new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000)
  );

  for (const userId of userIds) {
    // Create varying payment patterns for each month
    for (let i = 0; i < paymentDates.length; i++) {
      // Random payment behavior
      const willPay = Math.random() < 0.85; // 85% chance of payment
      const delayDays = Math.floor(Math.random() * 14); // 0-14 days delay
      const paymentStatus = Math.random() < 0.9 ? PaymentStatus.Successful : PaymentStatus.Failed;

      if (willPay) {
        const paymentDate = new Date(paymentDates[i].getTime() + delayDays * 24 * 60 * 60 * 1000);

        const payment = await prisma.payment.create({
          data: {
            userId,
            groupId,
            amount: group.contributionAmount,
            status: paymentStatus,
            paymentDate,
            stripePaymentIntentId: `pi_${Math.random().toString(36).substr(2, 9)}`,
          },
        });

        if (paymentStatus === PaymentStatus.Successful) {
          await prisma.transaction.create({
            data: {
              userId,
              groupId,
              amount: group.contributionAmount,
              transactionType: TransactionType.Debit,
              description: delayDays > 0 
                ? `Contribution to group (${delayDays} days late)`
                : 'Contribution to group',
              relatedPaymentId: payment.id,
            },
          });
        }
      }
    }

    // Create payouts for each user (2-3 payouts per user)
    const numberOfPayouts = 2 + Math.floor(Math.random() * 2);
    const payoutAmount = new Decimal(group.contributionAmount.toNumber() * 4);

    for (let i = 0; i < numberOfPayouts; i++) {
      const payoutDelay = Math.floor(Math.random() * 7); // 0-7 days delay
      const scheduledDate = new Date(Date.now() - (i + 1) * 60 * 24 * 60 * 60 * 1000);
      const actualPayoutDate = new Date(scheduledDate.getTime() + payoutDelay * 24 * 60 * 60 * 1000);

      const payout = await prisma.payout.create({
        data: {
          userId,
          groupId,
          amount: payoutAmount,
          status: PayoutStatus.Completed,
          scheduledPayoutDate: scheduledDate,
          stripeTransferId: `tr_${Math.random().toString(36).substr(2, 9)}`,
          payoutOrder: i + 1,
        },
      });

      await prisma.transaction.create({
        data: {
          userId,
          groupId,
          amount: payoutAmount,
          transactionType: TransactionType.Credit,
          transactionDate: actualPayoutDate,
          description: payoutDelay > 0 
            ? `Payout from group (${payoutDelay} days delayed)`
            : 'Payout from group',
          relatedPayoutId: payout.id,
        },
      });
    }
  }

  console.log('Seed data created successfully with varying patterns for all users!');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });