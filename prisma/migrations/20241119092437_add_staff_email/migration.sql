-- AlterTable
ALTER TABLE "TicketResponse" ADD COLUMN     "staffEmail" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;
