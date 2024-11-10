-- AlterTable
ALTER TABLE "User" ADD COLUMN     "becsSetupStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "stripeBecsPaymentMethodId" TEXT,
ADD COLUMN     "stripeMandateId" TEXT,
ADD COLUMN     "stripeSetupIntentId" TEXT;
