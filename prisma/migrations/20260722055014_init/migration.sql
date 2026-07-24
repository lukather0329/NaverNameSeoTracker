-- CreateTable
CREATE TABLE "ExcludedProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "smartStoreProductId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedProduct_smartStoreProductId_key" ON "ExcludedProduct"("smartStoreProductId");
