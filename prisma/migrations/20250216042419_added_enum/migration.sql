-- AlterEnum
ALTER TYPE "PauseReason" ADD VALUE 'CYCLE_COMPLETE';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "nextMemberPayoutOrder" INTEGER;
