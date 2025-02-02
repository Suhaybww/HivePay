-- AlterTable
ALTER TABLE "Contract" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "GroupMembership" ALTER COLUMN "payoutOrder" DROP NOT NULL;
