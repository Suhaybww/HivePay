-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('CONTRIBUTION', 'PAYOUT');

-- CreateTable
CREATE TABLE "GroupFutureCycle" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "cycleType" "CycleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupFutureCycle_pkey" PRIMARY KEY ("id")
);
