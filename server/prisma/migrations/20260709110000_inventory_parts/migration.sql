-- CreateTable
CREATE TABLE "InventoryPart" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryPart_assetId_idx" ON "InventoryPart"("assetId");

-- CreateIndex
CREATE INDEX "InventoryPart_partNumber_idx" ON "InventoryPart"("partNumber");

-- AddForeignKey
ALTER TABLE "InventoryPart" ADD CONSTRAINT "InventoryPart_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
