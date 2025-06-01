// Create a file: scripts/debug-payouts.ts
// Run with: npx tsx scripts/debug-payouts.ts

import { db } from "../src/db";

async function debugPayouts() {
  console.log("🔍 Debugging Payout Issues\n");

  // 1. Check recent successful payments
  const recentPayments = await db.payment.findMany({
    where: {
      status: "Successful",
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    include: {
      group: true,
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`📊 Recent Successful Payments: ${recentPayments.length}`);
  for (const payment of recentPayments) {
    console.log(`  - Payment ${payment.id}:`);
    console.log(`    Group: ${payment.group.name} (${payment.groupId})`);
    console.log(`    User: ${payment.user.email}`);
    console.log(`    Cycle: ${payment.cycleNumber}`);
    console.log(`    Amount: ${payment.amount}`);
    console.log(`    Stripe PI: ${payment.stripePaymentIntentId}`);
  }

  // 2. Check recent payouts
  const recentPayouts = await db.payout.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
    include: {
      group: true,
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`\n📊 Recent Payouts: ${recentPayouts.length}`);
  for (const payout of recentPayouts) {
    console.log(`  - Payout ${payout.id}:`);
    console.log(`    Group: ${payout.group.name} (${payout.groupId})`);
    console.log(`    User: ${payout.user.email}`);
    console.log(`    Order: ${payout.payoutOrder}`);
    console.log(`    Amount: ${payout.amount}`);
    console.log(`    Status: ${payout.status}`);
    console.log(`    Transfer ID: ${payout.stripeTransferId || "NULL"}`);
  }

  // 3. Check for missing payouts
  console.log("\n🔍 Checking for missing payouts...");
  
  // Get all groups with successful payments
  const groupsWithPayments = await db.group.findMany({
    where: {
      payments: {
        some: {
          status: "Successful",
        },
      },
    },
    include: {
      payments: {
        where: {
          status: "Successful",
        },
        orderBy: {
          cycleNumber: "asc",
        },
      },
      payouts: {
        orderBy: {
          payoutOrder: "asc",
        },
      },
      groupMemberships: {
        where: {
          status: "Active",
        },
      },
    },
  });

  for (const group of groupsWithPayments) {
    console.log(`\n  Group: ${group.name} (${group.id})`);
    console.log(`  Active Members: ${group.groupMemberships.length}`);
    console.log(`  Total Successful Payments: ${group.payments.length}`);
    console.log(`  Total Payouts: ${group.payouts.length}`);

    // Check each cycle
    const cycleNumbers = [...new Set(group.payments.map(p => p.cycleNumber))].filter(n => n !== null);
    
    for (const cycleNum of cycleNumbers) {
      const cyclePayments = group.payments.filter(p => p.cycleNumber === cycleNum);
      const cyclePayout = group.payouts.find(p => p.payoutOrder === cycleNum);
      
      console.log(`    Cycle ${cycleNum}:`);
      console.log(`      Payments: ${cyclePayments.length}`);
      console.log(`      Expected: ${group.groupMemberships.length - 1}`);
      console.log(`      Payout: ${cyclePayout ? "✅ Created" : "❌ MISSING"}`);
      
      if (!cyclePayout && cyclePayments.length === group.groupMemberships.length - 1) {
        console.log(`      ⚠️  All payments complete but payout missing!`);
      }
    }
  }

  // 4. Check error logs
  console.log("\n🔍 Checking error logs...");
  const errorLogs = await db.scheduledJobLog.findMany({
    where: {
      jobType: "PAYOUT_ERROR",
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`📊 Recent Payout Errors: ${errorLogs.length}`);
  for (const log of errorLogs) {
    console.log(`  - Error at ${log.createdAt}:`);
    console.log(`    Group: ${log.groupId}`);
    if (log.metadata) {
      try {
        const meta = JSON.parse(log.metadata);
        console.log(`    Error: ${meta.error}`);
        console.log(`    Payment Intent: ${meta.paymentIntentId}`);
      } catch (e) {
        console.log(`    Metadata: ${log.metadata}`);
      }
    }
  }

  await db.$disconnect();
}

debugPayouts().catch(console.error);