CREATE TABLE "StockAlertSubscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "consentRecordedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAlertSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockAlertSubscription_shop_dedupeKey_key"
ON "StockAlertSubscription"("shop", "dedupeKey");

CREATE INDEX "StockAlertSubscription_shop_inventoryItemId_status_idx"
ON "StockAlertSubscription"("shop", "inventoryItemId", "status");
