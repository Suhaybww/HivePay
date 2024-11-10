import { PrismaClient, Prisma, SubscriptionStatus, MembershipStatus, PaymentStatus, PayoutStatus, PayoutOrderMethod, Frequency } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create 11 users
  const userPromises = [];
  for (let i = 1; i <= 11; i++) {
    const user = prisma.user.create({
      data: {
        id: `user${i}`, // Use unique IDs or consider using `cuid()` for unique IDs
        firstName: `User`,
        lastName: `Number${i}`,
        email: `user${i}@example.com`,
        phoneNumber: `123456789${i}`,
        emailVerified: true,
        gender: i % 2 === 0 ? 'Male' : 'Female',
        age: 20 + i,
        passwordHash: '',
        stripeCustomerId: `cus_dummy_${i}`,
        stripeAccountId: `acct_dummy_${i}`,
        subscriptionStatus: SubscriptionStatus.Active,
        idVerified: true,
        verificationMethod: 'None',
        twoFactorEnabled: false,
        stripeSubscriptionId: `sub_dummy_${i}`,
        stripePriceId: `price_dummy`,
        stripeCurrentPeriodEnd: new Date(),
      },
    });
    userPromises.push(user);
  }

  const users = await Promise.all(userPromises);

  // Create or find the group
  const group = await prisma.group.upsert({
    where: { id: 'cm372stp40001e6za36md7rdh' },
    update: {},
    create: {
      id: 'cm372stp40001e6za36md7rdh',
      name: 'Dummy ROSCA Group',
      description: 'A dummy group for testing',
      createdById: users[0].id, // Set the first user as the creator
      payoutOrderMethod: PayoutOrderMethod.First_Come_First_Serve,
      contributionAmount: new Prisma.Decimal(1000),
      contributionFrequency: Frequency.BiWeekly,
      payoutFrequency: Frequency.BiWeekly,
      nextContributionDate: new Date(),
      nextPayoutDate: new Date(),
    },
  });

  // Create group memberships
  const membershipPromises = [];
  for (let i = 0; i < users.length; i++) {
    const membership = prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: users[i].id,
        joinDate: new Date(),
        payoutOrder: i + 1,
        isAdmin: users[i].id === group.createdById,
        status: MembershipStatus.Active,
      },
    });
    membershipPromises.push(membership);
  }
  await Promise.all(membershipPromises);

  // Create payments and payouts over 6 months
  const today = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  const fortnightInMs = 14 * 24 * 60 * 60 * 1000; // milliseconds in a fortnight

  const contributionsPromises = [];
  const payoutsPromises = [];

  for (let cycle = 0; cycle < 11; cycle++) {
    const contributionDate = new Date(startDate.getTime() + cycle * fortnightInMs);
    const payoutDate = new Date(contributionDate.getTime() + 1 * 24 * 60 * 60 * 1000); // Payout happens 1 day after contributions

    // Create payments from each user
    for (const user of users) {
      const payment = prisma.payment.create({
        data: {
          userId: user.id,
          groupId: group.id,
          amount: new Prisma.Decimal(1000),
          paymentDate: contributionDate,
          status: PaymentStatus.Successful,
          stripePaymentIntentId: `pi_dummy_${user.id}_${cycle}`,
          createdAt: contributionDate,
          updatedAt: contributionDate,
        },
      });
      contributionsPromises.push(payment);
    }

    // Create payout to one user
    const payoutUser = users[cycle % users.length]; // Rotate through users
    const payout = prisma.payout.create({
      data: {
        groupId: group.id,
        userId: payoutUser.id,
        scheduledPayoutDate: payoutDate,
        amount: new Prisma.Decimal(1000 * users.length),
        status: PayoutStatus.Completed,
        stripeTransferId: `tr_dummy_${payoutUser.id}_${cycle}`,
        createdAt: payoutDate,
        updatedAt: payoutDate,
      },
    });
    payoutsPromises.push(payout);
  }

  await Promise.all(contributionsPromises);
  await Promise.all(payoutsPromises);

  console.log('Database has been seeded. 🌱');
}

main()
  .catch((e) => {
    console.error('Error while seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
