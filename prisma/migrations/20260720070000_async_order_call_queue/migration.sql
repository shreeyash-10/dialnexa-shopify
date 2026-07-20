-- Convert synchronous order-call records into durable queued jobs.
ALTER TABLE "OrderCall"
ADD COLUMN "workflow" TEXT,
ADD COLUMN "recipientHash" TEXT,
ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "lockedAt" TIMESTAMP(3);

ALTER TABLE "OrderCall"
ALTER COLUMN "status" SET DEFAULT 'queued',
ALTER COLUMN "attempts" SET DEFAULT 0;

CREATE INDEX "OrderCall_status_availableAt_idx"
ON "OrderCall"("status", "availableAt");

CREATE INDEX "OrderCall_shop_recipientHash_createdAt_idx"
ON "OrderCall"("shop", "recipientHash", "createdAt");

CREATE TABLE "CallSuppression" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallSuppression_shop_recipientHash_key"
ON "CallSuppression"("shop", "recipientHash");

CREATE TABLE "AgentProvisioning" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "agentId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProvisioning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentProvisioning_shop_useCaseId_key"
ON "AgentProvisioning"("shop", "useCaseId");

CREATE INDEX "AgentProvisioning_status_updatedAt_idx"
ON "AgentProvisioning"("status", "updatedAt");
