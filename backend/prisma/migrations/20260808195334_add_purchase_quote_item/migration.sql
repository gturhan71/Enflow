-- CreateTable
CREATE TABLE "PurchaseQuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseQuoteId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseQuoteItem_purchaseQuoteId_fkey" FOREIGN KEY ("purchaseQuoteId") REFERENCES "PurchaseQuote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseQuoteItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseQuoteItem_purchaseQuoteId_purchaseItemId_key" ON "PurchaseQuoteItem"("purchaseQuoteId", "purchaseItemId");
