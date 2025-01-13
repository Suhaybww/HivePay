-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('Active', 'PendingCancel', 'Inactive', 'Canceled');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('Active', 'Paused');

-- CreateEnum
CREATE TYPE "PauseReason" AS ENUM ('PAYMENT_FAILURES', 'REFUND_ALL', 'INACTIVE_SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('Active', 'Inactive', 'Pending');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Successful', 'Failed');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('Weekly', 'BiWeekly', 'Monthly');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('Debit', 'Credit');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Female', 'Male');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "BECSSetupStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('Pending', 'Signed', 'Rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "gender" "Gender",
    "age" INTEGER,
    "stripe_customer_id" TEXT,
    "stripeAccountId" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),
    "stripeSetupIntentId" TEXT,
    "stripeBecsPaymentMethodId" TEXT,
    "becsSetupStatus" "BECSSetupStatus" NOT NULL DEFAULT 'Pending',
    "stripeMandateId" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'Pending',
    "onboardingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletionReason" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "groupLimit" INTEGER NOT NULL,
    "memberLimit" INTEGER NOT NULL,
    "payoutCycles" INTEGER NOT NULL,
    "features" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "contributionAmount" DECIMAL(10,2),
    "cycleFrequency" "Frequency",
    "nextCycleDate" TIMESTAMP(3),
    "cycleStarted" BOOLEAN NOT NULL DEFAULT false,
    "status" "GroupStatus" NOT NULL DEFAULT 'Active',
    "pauseReason" "PauseReason",
    "futureCyclesJson" JSONB,
    "updateGroupPaymentStatstotalDebitedAmount" DECIMAL(65,30) DEFAULT 0,
    "totalPendingAmount" DECIMAL(65,30) DEFAULT 0,
    "totalSuccessAmount" DECIMAL(65,30) DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutOrder" INTEGER NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "MembershipStatus" NOT NULL,
    "acceptedTOSAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Pending',
    "stripePaymentIntentId" TEXT,
    "mandateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledPayoutDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'Pending',
    "stripeTransferId" TEXT,
    "payoutOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "relatedPaymentId" TEXT,
    "relatedPayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'Open',
    "priority" "TicketPriority" NOT NULL DEFAULT 'Medium',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketResponse" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "staffEmail" TEXT,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractTemplateId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'Pending',
    "signedContent" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "fullName" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_customer_id_key" ON "User"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_subscription_id_key" ON "User"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key" ON "GroupMembership"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripeTransferId_key" ON "Payout"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_version_key" ON "ContractTemplate"("version");

-- CreateIndex
CREATE INDEX "Invitation_groupId_idx" ON "Invitation"("groupId");

-- CreateIndex
CREATE INDEX "Invitation_invitedById_idx" ON "Invitation"("invitedById");
