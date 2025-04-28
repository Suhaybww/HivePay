-- CreateTable
CREATE TABLE "ScheduledJobLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "delayMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRecoveryLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "recoveryType" TEXT NOT NULL,
    "cycleNumber" INTEGER,
    "jobId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRecoveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecoveryLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recoveryType" TEXT NOT NULL,
    "jobId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecoveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHealthLog" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "queueMetrics" TEXT,
    "memoryUsage" DOUBLE PRECISION,
    "cpuUsage" DOUBLE PRECISION,
    "redisConnected" BOOLEAN NOT NULL,
    "databaseConnected" BOOLEAN NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "hostname" TEXT,
    "details" TEXT,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledJobLog_groupId_idx" ON "ScheduledJobLog"("groupId");

-- CreateIndex
CREATE INDEX "ScheduledJobLog_status_idx" ON "ScheduledJobLog"("status");

-- CreateIndex
CREATE INDEX "ScheduledJobLog_jobType_idx" ON "ScheduledJobLog"("jobType");

-- CreateIndex
CREATE INDEX "GroupRecoveryLog_groupId_idx" ON "GroupRecoveryLog"("groupId");

-- CreateIndex
CREATE INDEX "GroupRecoveryLog_recoveryType_idx" ON "GroupRecoveryLog"("recoveryType");

-- CreateIndex
CREATE INDEX "PaymentRecoveryLog_paymentId_idx" ON "PaymentRecoveryLog"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentRecoveryLog_groupId_idx" ON "PaymentRecoveryLog"("groupId");

-- CreateIndex
CREATE INDEX "PaymentRecoveryLog_userId_idx" ON "PaymentRecoveryLog"("userId");

-- CreateIndex
CREATE INDEX "WorkerHealthLog_workerId_idx" ON "WorkerHealthLog"("workerId");

-- CreateIndex
CREATE INDEX "WorkerHealthLog_status_idx" ON "WorkerHealthLog"("status");

-- CreateIndex
CREATE INDEX "WorkerHealthLog_createdAt_idx" ON "WorkerHealthLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerHeartbeat_workerId_key" ON "WorkerHeartbeat"("workerId");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_workerId_idx" ON "WorkerHeartbeat"("workerId");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_lastHeartbeat_idx" ON "WorkerHeartbeat"("lastHeartbeat");
