CREATE TABLE "UseCaseCall" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "encryptedPayload" TEXT,
    "recipientHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dialnexaCallId" TEXT,
    "resolved" BOOLEAN,
    "outcome" TEXT,
    "needsHumanFollowUp" BOOLEAN,
    "error" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UseCaseCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UseCaseCall_shop_dedupeKey_key" ON "UseCaseCall"("shop", "dedupeKey");
CREATE INDEX "UseCaseCall_status_availableAt_idx" ON "UseCaseCall"("status", "availableAt");
CREATE INDEX "UseCaseCall_shop_useCaseId_status_idx" ON "UseCaseCall"("shop", "useCaseId", "status");
CREATE INDEX "UseCaseCall_shop_recipientHash_createdAt_idx" ON "UseCaseCall"("shop", "recipientHash", "createdAt");
CREATE INDEX "UseCaseCall_dialnexaCallId_idx" ON "UseCaseCall"("dialnexaCallId");

ALTER TABLE "OrderCall"
ADD COLUMN "resolved" BOOLEAN,
ADD COLUMN "outcome" TEXT,
ADD COLUMN "needsHumanFollowUp" BOOLEAN,
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "OrderCall_dialnexaCallId_idx" ON "OrderCall"("dialnexaCallId");

CREATE TABLE "SchedulerState" (
    "name" TEXT NOT NULL,
    "cursorShop" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerState_pkey" PRIMARY KEY ("name")
);
