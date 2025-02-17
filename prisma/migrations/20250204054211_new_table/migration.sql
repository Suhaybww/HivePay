-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('Scheduled', 'Active', 'Completed', 'Partial', 'Failed');

-- CreateTable
CREATE TABLE "GroupCycle" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "payeeUserId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'Completed',
    "successfulPayments" INTEGER NOT NULL,
    "failedPayments" INTEGER NOT NULL,
    "pendingPayments" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupCycle_pkey" PRIMARY KEY ("id")
);
