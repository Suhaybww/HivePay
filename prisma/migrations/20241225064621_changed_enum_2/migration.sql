
/*
  Warnings:

  - The values [Daily,Custom] on the enum `Frequency` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `contributionFrequency` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `nextContributionDate` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `nextPayoutDate` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `payoutFrequency` on the `Group` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Frequency_new" AS ENUM ('Weekly', 'BiWeekly', 'Monthly');
ALTER TABLE "Group" ALTER COLUMN "cycleFrequency" TYPE "Frequency_new" USING ("cycleFrequency"::text::"Frequency_new");
ALTER TYPE "Frequency" RENAME TO "Frequency_old";
ALTER TYPE "Frequency_new" RENAME TO "Frequency";
DROP TYPE "Frequency_old";
COMMIT;

-- AlterTable
ALTER TABLE "Feedback" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "contributionFrequency",
DROP COLUMN "nextContributionDate",
DROP COLUMN "nextPayoutDate",
DROP COLUMN "payoutFrequency",
ADD COLUMN     "cycleFrequency" "Frequency",
ADD COLUMN     "nextCycleDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TicketResponse" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
