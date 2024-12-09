-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'Pending';

-- AlterTable
ALTER TABLE "GroupMembership" ALTER COLUMN "status" SET DEFAULT 'Pending';
